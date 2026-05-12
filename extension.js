/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import {
    Extension,
    gettext as _,
} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {
    getClocksSettings,
    getSettings,
    showAlarms,
    getNextAlarm,
} from './convenience.js';

const DEFAULT_TEXT = '';

const GnomeAlarmsIndicator = GObject.registerClass(
    { GTypeName: 'GnomeAlarmsIndicator' },
    class GnomeAlarmsIndicator extends PanelMenu.Button {
        _init(extension) {
            super._init(0.5, _('Gnome Alarms indicator'), false);
            this._extension = extension;

            let box = new St.BoxLayout({
                style_class: 'panel-status-indicators-box',
            });

            this.icon = new St.Icon({
                style_class: 'system-status-icon',
                icon_name: 'alarm-symbolic',
            });

            this.label = new St.Label({
                text: DEFAULT_TEXT,
                y_align: Clutter.ActorAlign.CENTER,
            });

            box.add_child(this.icon);
            box.add_child(this.label);
            this.add_child(box);

            this._buildMenu();

            this.clockSettings = getClocksSettings();
            this._alarmChangedId = 0;
            this._connectClocksSignal();
        }

        _buildMenu() {
            const alarmsItem = new PopupMenu.PopupMenuItem(_('Clocks...'));
            alarmsItem.connect('activate', () => {
                showAlarms(this.clockSettings);
            });
            this.menu.addMenuItem(alarmsItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            const settingsItem = new PopupMenu.PopupMenuItem(_('Settings...'));
            settingsItem.connect('activate', () => {
                this._extension.openPreferences();
            });
            this.menu.addMenuItem(settingsItem);
        }

        /**
         * Formats time with leading zeros (e.g., 9:5 -> 09:05).
         */
        _formatTime(hour, minute) {
            const hh = String(hour).padStart(2, '0');
            const mm = String(minute).padStart(2, '0');
            return `${hh}:${mm}`;
        }

        /**
         * Updates the panel label with the next alarm info.
         */
        _updateLabel() {
            if (!this.clockSettings) return;

            try {
                const alarms = this.clockSettings.get_value('alarms');
                const nextAlarm = getNextAlarm(alarms);

                if (!nextAlarm) {
                    this.label.set_text(DEFAULT_TEXT);
                    this.label.hide();
                    this.icon.margin_right = 0;
                    this.icon.opacity = 140; // Dimmed when no alarms
                    return;
                }

                this.label.show();
                this.icon.margin_right = 5;
                this.icon.opacity = 255; // Bright when alarm is active
                const { name, hour, minute, left } = nextAlarm;
                const time = this._formatTime(hour, minute);
                const text = left
                    ? `${left} • ${name} [${time}]`
                    : `${name} [${time}]`;

                this.label.set_text(text);
            } catch (e) {
                console.error(`Gnome Alarms Error: ${e.message}`);
            }
        }

        /**
         * Handler for button press - refreshes and opens Gnome Clocks.
         */
        _onButtonPressed() {
            this._updateLabel();
        }

        /**
         * Refreshes the alarm display. Called periodically by the timer.
         * Also auto-launches Gnome Clocks if an alarm is about to trigger.
         */
        refresh() {
            this._updateLabel();

            try {
                const alarms = this.clockSettings.get_value('alarms');
                const nextAlarm = getNextAlarm(alarms);

                if (nextAlarm) {
                    const { diffMinutes } = nextAlarm;
                    // Auto-launch Gnome Clocks if alarm is within 2 minutes
                    if (diffMinutes >= 0 && diffMinutes <= 2) {
                        showAlarms(this.clockSettings);
                    }
                }
            } catch (e) {
                console.error('Gnome Alarms: Error in refresh', e);
            }
        }

        /**
         * Connect to settings changes to update the label when alarms change.
         */
        _connectClocksSignal() {
            if (!this.clockSettings) return;

            this._alarmChangedId = this.clockSettings.connect(
                'changed::alarms',
                () => this._updateLabel(),
            );
        }
    },
);

export default class GnomeAlarmsExtension extends Extension {
    enable() {
        const refreshInterval = 60 * 1000; // One minute
        this._settings = getSettings(this);

        this._indicator = new GnomeAlarmsIndicator(this);
        this._addIndicator();

        // First refresh
        this._indicator.refresh();

        this._timeout = GLib.timeout_add(0, refreshInterval, () => {
            this._indicator.refresh();
            return true;
        });

        this._settingsChangedId = this._settings.connect(
            'changed::position',
            () => {
                this._readdIndicator();
            },
        );
        this._settingsIndexChangedId = this._settings.connect(
            'changed::position-index',
            () => {
                this._readdIndicator();
            },
        );
    }

    _addIndicator() {
        const position = this._settings.get_string('position');
        const index = this._settings.get_int('position-index');
        Main.panel.addToStatusArea(this.uuid, this._indicator, index, position);
    }

    _readdIndicator() {
        // We can't easily "move" it, so we remove and add back
        Main.panel.statusArea[this.uuid] = null;
        this._indicator.destroy();
        this._indicator = new GnomeAlarmsIndicator(this);
        this._addIndicator();
        this._indicator.refresh();
    }

    disable() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = 0;
        }
        if (this._settingsIndexChangedId) {
            this._settings.disconnect(this._settingsIndexChangedId);
            this._settingsIndexChangedId = 0;
        }

        GLib.source_remove(this._timeout);

        if (!this._indicator.clockSettings) {
            console.error('Gnome Alarms: org.gnome.clocks is not installed.');
            return;
        }

        this._indicator.clockSettings.disconnect(
            this._indicator._alarmChangedId,
        );
        this._indicator.destroy();
        this._indicator = null;
    }
}
