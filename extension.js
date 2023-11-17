import GObject from 'gi://GObject';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import Clutter from 'gi://Clutter';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

const TOGGLE_STATE_KEY = 'enabled';

const Toggle = GObject.registerClass(
  class Toggle extends QuickSettings.QuickToggle {
    _init(settings) {
      super._init({
        title: _('Invert Colors'),
        toggleMode: true,
        icon_name: 'edit-redo',
      });

      this._settings = settings;

      this._handlerId = this._settings.connect('changed::' + TOGGLE_STATE_KEY,
        () => this._sync());

      this.connectObject(
        'clicked', () => this._toggleMode(),
        this);
      this._sync();
    }

    _toggleMode() {
      Main.layoutManager.screenTransition.run();
      this._settings.set_boolean(TOGGLE_STATE_KEY, !this.isEnabled());
    }

    _sync() {
      this.set({
        checked: this.isEnabled(),
      });
    }

    isEnabled() {
      return this._settings.get_boolean(TOGGLE_STATE_KEY);
    }

    destroy() {
      if (this._handlerId) {
        this._settings.disconnect(this._handlerId);
        this._handlerId = null;
      }
      this._settings = null;
      super.destroy();
    }
  }
);

const SystemIndicator = GObject.registerClass(
  class SystemIndicator extends QuickSettings.SystemIndicator {
    _init(settings) {
      super._init();
      this.quickSettingsItems.push(new Toggle(settings));
    }

    destroy() {
      this.quickSettingsItems.forEach((item) => item.destroy());
      super.destroy();
    }
  })

const InvertEffect = GObject.registerClass(
  class InvertEffect extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
      return `
uniform sampler2D tex;
void main() {
  vec4 color = texture2D(tex, cogl_tex_coord_in[0].st);
  if(color.a > 0.0) {
    color.rgb /= color.a;
  }
  color.rgb = vec3(1.0, 1.0, 1.0) - color.rgb;
  color.rgb *= color.a;
  cogl_color_out = color * cogl_color_in;
}`;
    }

    vfunc_paint_target(node, paint_context) {
      this.set_uniform_value('tex', 0);
      super.vfunc_paint_target(node, paint_context);
    }
  });

const EffectManager = GObject.registerClass(
  class EffectManager extends GObject.Object {
    constructor(settings, effect) {
      super();
      this._settings = settings;
      this._effect = effect;
      this._handlerId = this._settings.connect('changed::' + TOGGLE_STATE_KEY,
        () => this._sync());
      this._sync();
    }

    isEnabled() {
      return this._settings.get_boolean(TOGGLE_STATE_KEY);
    }

    _sync() {
      if (this.isEnabled()) {
        Main.uiGroup.add_effect(this._effect);
      } else {
        Main.uiGroup.remove_effect(this._effect);
      }
    }

    destroy() {
      if (this._handlerId) {
        this._settings.disconnect(this._handlerId);
        this._handlerId = null;
      }
      this._settings = null;
      if (this._effect) {
        Main.uiGroup.remove_effect(this._effect);
        this._effect = null;
      }
    }
  });

export default class IndicatorExampleExtension extends Extension {
  constructor(config) {
    super(config);
    this._effect = new InvertEffect();
  }

  enable() {
    this._settings = this.getSettings();
    this._settings.set_boolean(TOGGLE_STATE_KEY, false);
    this._indicator = new SystemIndicator(this._settings, this.metadata.name);
    this._shader = new EffectManager(this._settings, this._effect, this.metadata.name);
    Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
  }

  disable() {
    this._indicator.destroy();
    this._indicator = null;
    this._shader.destroy();
    this._shader = null;
    this._settings = null;
  }
}
