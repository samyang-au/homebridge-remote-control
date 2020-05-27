import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';
import { Gpio } from 'onoff';

import { HomebridgeRemoteControlPlatform } from './platform';

enum TargetDoorState {
    OPEN = 0,
    CLOSED = 1,
};

enum CurrentDoorState {
    OPEN = 0,
    CLOSED = 1,
    OPENING = 2,
    CLOSING = 3,
    STOPPED = 4,
};

const DEFAULT_DELAY = 10000;

export interface MyAccessory {
    name: string,
    pin: number,
    delay?: number,
    defaultState?: 'open' | 'close'
}
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class RemoteControlAccessory {
    private remoteService: Service;

    private currentDoorState: CurrentDoorState;
    private timeoutHandle: any;
    private readonly relay: any;
    private config: MyAccessory;

    constructor(
        private readonly platform: HomebridgeRemoteControlPlatform,
        private readonly accessory: PlatformAccessory,
    ) {
        this.config = accessory.context as MyAccessory;
        this.relay = new Gpio(this.config.pin, 'out');

        // set accessory information
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
            .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

        this.remoteService = this.accessory.getService(this.platform.Service.GarageDoorOpener) || this.accessory.addService(this.platform.Service.GarageDoorOpener);

        this.remoteService.setCharacteristic(this.platform.Characteristic.Name, this.config.name);

        this.remoteService
            .getCharacteristic(this.platform.Characteristic.CurrentDoorState)
            .on('get', this.getCurrentDoorState.bind(this));
        this.remoteService
            .getCharacteristic(this.platform.Characteristic.TargetDoorState)
            .on('set', this.setTargetDoorState.bind(this));
        this.currentDoorState =
            this.config.defaultState === 'close' ? CurrentDoorState.CLOSED : CurrentDoorState.OPEN;
        this.remoteService.updateCharacteristic(this.platform.Characteristic.CurrentDoorState, this.currentDoorState)
    }

    readonly getCurrentDoorState = (callback: CharacteristicGetCallback) => {
        this.platform.log.debug('getCurrentDoorState: ' + CurrentDoorState[this.currentDoorState]);
        callback(null, this.currentDoorState);
    };

    readonly setCurrentDoorState = (state: CurrentDoorState) => {
        this.platform.log.debug('setting current door state to ' + CurrentDoorState[state]);
        this.currentDoorState = state;
        this.remoteService
            .getCharacteristic(this.platform.Characteristic.CurrentDoorState)
            .setValue(state);
    };

    readonly setTargetDoorState = (targetState: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.platform.log.debug(`(${CurrentDoorState[this.currentDoorState]}) trying to ${TargetDoorState[targetState as TargetDoorState].toLowerCase()} ${this.config.name}`);

        switch (this.currentDoorState) {
            case CurrentDoorState.OPEN:
                this.sendRemoteSignal();
                if (targetState == TargetDoorState.CLOSED) {
                    this.setCurrentDoorState(CurrentDoorState.CLOSING);
                    this.timeoutHandle = setTimeout(() => this.setCurrentDoorState(CurrentDoorState.CLOSED), this.config.delay || DEFAULT_DELAY);
                }
                break;
            case CurrentDoorState.CLOSED:
                this.sendRemoteSignal();
                if (targetState == TargetDoorState.OPEN) {
                    this.setCurrentDoorState(CurrentDoorState.OPENING);
                    this.timeoutHandle = setTimeout(() => this.setCurrentDoorState(CurrentDoorState.OPEN), this.config.delay || DEFAULT_DELAY);
                }
                break;
            case CurrentDoorState.OPENING:
            case CurrentDoorState.CLOSING:
                if (this.currentDoorState === CurrentDoorState.OPENING && targetState == TargetDoorState.CLOSED
                    || this.currentDoorState === CurrentDoorState.CLOSING && targetState == TargetDoorState.OPEN) {
                    clearTimeout(this.timeoutHandle);
                    if (this.currentDoorState === CurrentDoorState.OPENING) {
                        this.setCurrentDoorState(CurrentDoorState.CLOSING);
                    } else {
                        this.setCurrentDoorState(CurrentDoorState.OPENING);
                    }
                    this.sendRemoteSignal();
                    setTimeout(() => {
                        this.sendRemoteSignal();
                        this.timeoutHandle = setTimeout(() => this.setCurrentDoorState(targetState as any), this.config.delay || DEFAULT_DELAY);
                    }, 2000);
                }
                break;
            case CurrentDoorState.STOPPED:
                break;
        }
        callback(null, this.currentDoorState);
    };

    sendRemoteSignal() {
        this.relay.writeSync(1);
        this.platform.log.debug(this.config.name + ' remote pin on...');
        setTimeout(() => {
            this.relay.writeSync(0);
            this.platform.log.debug(this.config.name + ' remote pin off...');
        }, 1000);
    }

}