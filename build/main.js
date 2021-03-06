"use strict";
/*
 * Created with @iobroker/create-adapter v1.24.2
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const node_fetch_1 = require("node-fetch");
class MystromSwitch extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign(Object.assign({}, options), { name: "mystrom-wifi-switch" }));
        this.interval = 60;
        this.on("ready", this.onReady.bind(this));
        //this.on("objectChange", this.onObjectChange.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.setObjectAsync('switchState', {
                type: 'state',
                common: {
                    name: 'switchState',
                    type: 'boolean',
                    role: 'indicator',
                    read: true,
                    write: true
                },
                native: {}
            });
            yield this.setObjectAsync('power', {
                type: 'state',
                common: {
                    name: 'switchPower',
                    type: 'number',
                    read: true,
                    write: false,
                    role: 'value'
                },
                native: {}
            });
            /**
          * Energy since installation of the adapter (Wh)
          */
            yield this.setObjectAsync('total_energy', {
                type: 'state',
                common: {
                    name: 'total energy',
                    type: 'number',
                    read: true,
                    write: false,
                    role: 'value'
                },
                native: {}
            });
            /**
             * energy of the current day (Wh)
             */
            yield this.setObjectAsync('day_energy', {
                type: 'state',
                common: {
                    name: 'day energy',
                    type: 'number',
                    read: true,
                    write: true,
                    role: 'value'
                },
                native: {}
            });
            /**
            * Energy since last disconnection (Ws)
            */
            yield this.setObjectAsync('consumed_energy', {
                type: 'state',
                common: {
                    name: 'consumed energy',
                    type: 'number',
                    read: true,
                    write: true,
                    role: 'value'
                },
                native: {}
            });
            /**
             * Temperature
             */
            yield this.setObjectAsync('temperature', {
                type: 'state',
                common: {
                    name: 'temperature',
                    type: 'number',
                    read: true,
                    write: false,
                    role: 'value'
                },
                native: {}
            });
            yield this.setObjectAsync('info.description', {
                "type": "state",
                "common": {
                    "role": "text",
                    "name": "Description",
                    "type": "string",
                    "read": true,
                    "write": true
                },
                "native": {}
            });
            const desc = yield this.getStateAsync("info.decription");
            if (!desc) {
                this.setStateAsync("info.description", this.namespace);
            }
            // in this template all states changes inside the adapters namespace are subscribed
            this.subscribeStates("*");
            this.interval = this.config.pollingInterval || 60;
            this.interval = Math.max(this.interval, 3);
            this.setStateAsync("info.connection", true, true);
            yield this.checkStates();
            this.log.info("setting interval to " + this.interval + " seconds");
            this.intervalObj = setInterval(this.checkStates.bind(this), this.interval * 1000);
        });
    }
    checkStates() {
        return __awaiter(this, void 0, void 0, function* () {
            const url = this.config.url;
            // this.log.info("checkstates url " + url)
            //Get report
            const result = yield this.doFetch("/report");
            this.log.info("result from " + url + ":" + JSON.stringify(result));
            if (result) {
                yield this.setStateAsync("switchState", result.relay, true);
                yield this.setStateAsync("power", result.power, true);
                var wattseconds = result.power * this.interval;
                var totalState = yield this.getStateAsync("total_energy");
                if (!totalState) {
                    totalState = { val: 0, ack: false, ts: new Date().getDate(), lc: new Date().getDate(), from: "" };
                }
                if (totalState) {
                    let val = (totalState.val || 0);
                    val = val + wattseconds / 3600;
                    yield this.setStateAsync("total_energy", { val, ack: true });
                }
                //Get temperature
                if (result.hasOwnProperty('temperature')) {
                    yield this.setStateAsync("temperature", { val: result.temperature, ack: true });
                }
                else {
                    yield this.setStateAsync("temperature", { val: 0.0, ack: true });
                }
            }
        });
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            if (this.intervalObj) {
                clearInterval(this.intervalObj);
            }
            this.log.info("cleaned everything up...");
            callback();
        }
        catch (e) {
            callback();
        }
    }
    /**
     * Is called if a subscribed state changes
     */
    onStateChange(id, state) {
        if (state && !state.ack) {
            if (state.val == true) {
                this.doFetch("/relay?state=1");
            }
            else if (state.val == false) {
                this.doFetch("/relay?state=0");
            }
            else {
                this.log.silly("undefined state: " + state.val);
            }
        }
    }
    doFetch(addr) {
        return __awaiter(this, void 0, void 0, function* () {
            let url = this.config.url;
            if (url.indexOf("://") == -1) {
                url = "http://" + url;
            }
            this.log.silly("Fetching " + url + addr);
            try {
                const response = yield node_fetch_1.default(url + addr, { method: "get" });
                if (response.status == 200) {
                    const text = yield response.text();
                    this.log.debug("got: " + text);
                    if (text.length) {
                        return JSON.parse(text);
                    }
                    return text;
                }
                else {
                    this.log.error("Error while fetching " + addr + ": " + response.status);
                    this.setState("info.connection", false, true);
                    return undefined;
                }
            }
            catch (err) {
                this.log.error("Fatal error during fetch " + err);
                this.setState("info.connection", false, true);
                return undefined;
            }
        });
    }
}
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options) => new MystromSwitch(options);
}
else {
    // otherwise start the instance directly
    (() => new MystromSwitch())();
}
