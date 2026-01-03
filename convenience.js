import Gio from 'gi://Gio';

export const getClocksSettings = () => {
    try {
        return new Gio.Settings({ schema: 'org.gnome.clocks' });
    } catch {
        throw new Error(`
    =======================================================================
    Gnome Clocks is not installed natively, please check your installation!
    (Snap or Flatpak are not supported!)
    =======================================================================`);
    }
};

/**
 * Opens the gnome.org.clocks window via dbus.
 */
export const showAlarms = (clockSettings) => {
    if (!clockSettings) return;

    const MyClockIface = `<node>
        <interface name="org.freedesktop.Application">
            <method name="Activate">
                <arg type="a{sv}" name="platform-data" direction="in"/>
            </method>
        </interface>
    </node>`;
    const MyClockProxy = Gio.DBusProxy.makeProxyWrapper(MyClockIface);

    new MyClockProxy(
        Gio.DBus.session,
        'org.gnome.clocks',
        '/org/gnome/clocks',
        (proxy, error) => {
            if (error) return console.error('Error creating proxy:', error);
            proxy.ActivateRemote((_, err) => {
                if (err) console.error('Error activating Clocks:', err);
            });
        },
    );
};

/**
 * Converts minutes to a string like 1d 07h 53m.
 */
export const minutesToString = (min) => {
    const totalMin = Math.max(0, parseInt(min, 10));
    if (totalMin === 0) return '';

    const days = Math.floor(totalMin / (24 * 60));
    const hours = Math.floor((totalMin / 60) % 24);
    const minutes = totalMin % 60;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');

    if (days > 0) return `${days}d ${hh}h ${mm}m`;
    if (hours > 0) return `${hours}h ${mm}m`;
    return `${minutes}m`;
};

/**
 * Unpacks GVariant boxed values if necessary.
 */
const safeUnpack = (v) => {
    if (v && typeof v.unpack === 'function') return v.unpack();
    return v;
};

const getDayNum = (dayNum) => {
    if (dayNum > 7) return dayNum - 7;
    return dayNum === 0 ? 7 : dayNum;
};

const filterNearest = (alarms, iteration) => {
    const timeMultiplicate = iteration * 24 * 60 * 60 * 1000;
    const now = new Date();
    const date = new Date(now.getTime() + timeMultiplicate);
    const day = date.getDay();
    const nowDay = getDayNum(day);

    return alarms
        .map((alarm) => {
            const ringTime = new Date(now);
            ringTime.setDate(now.getDate() + iteration);
            ringTime.setHours(alarm.hour, alarm.minute, 0, 0);

            const diff = ringTime.getTime() - now.getTime();
            const diffMinutes = Math.floor(diff / 1000 / 60);

            if (diff <= 0 && !iteration) return null;
            if (alarm.days.length && !alarm.days.includes(nowDay)) return null;

            return {
                ...alarm,
                left: minutesToString(diffMinutes),
                diffMinutes,
            };
        })
        .filter((a) => a);
};

export const getNextAlarm = (alarmsPacked) => {
    const rawAlarms = alarmsPacked.deep_unpack() || [];

    const alarms = rawAlarms
        .map((obj) => ({
            name: safeUnpack(obj.name),
            hour: safeUnpack(obj.hour),
            minute: safeUnpack(obj.minute),
            days: (safeUnpack(obj.days) || []).map(safeUnpack),
            active: safeUnpack(obj.active),
            ring_time: safeUnpack(obj.ring_time),
        }))
        // An alarm is active if 'active' is not false AND it has a ring_time
        .filter((a) => a.active !== false && a.ring_time);

    for (let i = 0; i < 8; i++) {
        const nearestAlarm = filterNearest(alarms, i);
        if (nearestAlarm.length) {
            return nearestAlarm.sort(
                (a, b) => a.diffMinutes - b.diffMinutes,
            )[0];
        }
    }
    return null;
};
