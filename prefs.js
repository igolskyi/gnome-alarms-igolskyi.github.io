import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GnomeAlarmsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: _('Appearance'),
            description: _(
                'Configure how the indicator looks and where it is located',
            ),
        });
        page.add(group);

        // Position setting
        const positionRow = new Adw.ComboRow({
            title: _('Indicator Position'),
            subtitle: _('Where to show the indicator on the panel'),
            model: new Gtk.StringList({
                strings: [_('Left'), _('Center'), _('Right')],
            }),
        });

        // Map index to value and vice versa
        const positionMap = ['left', 'center', 'right'];

        // Initialize selection from settings
        const currentPosition = settings.get_string('position');
        const currentIndex = positionMap.indexOf(currentPosition);
        if (currentIndex !== -1) {
            positionRow.selected = currentIndex;
        }

        positionRow.connect('notify::selected', () => {
            const selectedValue = positionMap[positionRow.selected];
            settings.set_string('position', selectedValue);
        });

        group.add(positionRow);

        // Position index setting
        const indexRow = new Adw.SpinRow({
            title: _('Position Index'),
            subtitle: _(
                'The relative position within the selected panel section',
            ),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 10,
                step_increment: 1,
            }),
        });
        settings.bind(
            'position-index',
            indexRow,
            'value',
            Gio.SettingsBindFlags.DEFAULT,
        );
        group.add(indexRow);
    }
}
