/*
 * Created with @iobroker/create-adapter v1.24.2
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";
import fetch from "node-fetch"


// Load your modules here, e.g.:
// import * as fs from "fs";

// Augment the adapter.config object with the actual types
// TODO: delete this in the next version
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ioBroker {
    interface AdapterConfig {
      url: string;
      pollingInterval: number;
    }
  }
}

class MystromSwitch extends utils.Adapter {
  private intervalObj: any
  private interval = 60
  public constructor(options: Partial<utils.AdapterOptions> = {}) {
    super({
      ...options,
      name: "mystrom-wifi-switch",
    });
    this.on("ready", this.onReady.bind(this));
    //this.on("objectChange", this.onObjectChange.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    // this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }

  /**
   * Is called when databases are connected and adapter received configuration.
   */
  private async onReady(): Promise<void> {

    await this.setObjectAsync('switchState', {
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

    await this.setObjectAsync('power', {
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
    await this.setObjectAsync('total_energy', {
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
    await this.setObjectAsync('day_energy', {
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
    await this.setObjectAsync('consumed_energy', {
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
    await this.setObjectAsync('temperature', {
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

    await this.setObjectAsync('info.description', {
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

    const desc = await this.getStateAsync("info.decription")
    if (!desc) {
      this.setStateAsync("info.description", this.namespace)
    }


    // in this template all states changes inside the adapters namespace are subscribed
    this.subscribeStates("*");

    this.interval = this.config.pollingInterval || 60
    this.interval = Math.max(this.interval, 3)

    this.setStateAsync("info.connection", true, true)
    await this.checkStates();
    this.log.info("setting interval to " + this.interval + " seconds")
    this.intervalObj = setInterval(this.checkStates.bind(this), this.interval * 1000);
  }



  private async checkStates() {
    const url = this.config.url;
    // this.log.info("checkstates url " + url)
    //Get report
    const result = await this.doFetch("/report")
    this.log.info("result from " + url + ":" + JSON.stringify(result))
    if (result) {
      await this.setStateAsync("switchState", result.relay, true)
      await this.setStateAsync("power", result.power, true)
      var wattseconds = result.power * this.interval;
      var totalState = await this.getStateAsync("total_energy")
      if(!totalState){
        totalState={val: 0, ack:false,ts: new Date().getDate(), lc: new Date().getDate(), from: ""}
      }
      if (totalState) {
        let val = (totalState.val || 0) as number
        val = val + wattseconds / 3600;
        await this.setStateAsync("total_energy", { val, ack: true });
      }
      //Get temperature
      if (result.hasOwnProperty('temperature')) {
        await this.setStateAsync("temperature", { val: result.temperature, ack: true })
      } else {
        await this.setStateAsync("temperature", { val: 0.0, ack: true })
      }

    }
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  private onUnload(callback: () => void): void {
    try {
      if (this.intervalObj) {
        clearInterval(this.intervalObj)
      }
      this.log.info("cleaned everything up...");
      callback();
    } catch (e) {
      callback();
    }
  }

  /**
   * Is called if a subscribed state changes
   */
  private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
    if (state && !state.ack) {
      if (state.val == true) {
        this.doFetch("/relay?state=1");
      } else if (state.val == false) {
        this.doFetch("/relay?state=0");
      }
      else {
        this.log.silly("undefined state: " + state.val)
      }
    }
  }


  private async doFetch(addr: string): Promise<any> {
    let url = this.config.url
    if (url.indexOf("://") == -1) {
      url = "http://" + url
    }
    this.log.silly("Fetching " + url + addr)
    try {
      const response = await fetch(url + addr, { method: "get" })
      if (response.status == 200) {
        const text = await response.text()
        this.log.debug("got: " + text)
        if (text.length) {
          return JSON.parse(text)
        }
        return text
      } else {
        this.log.error("Error while fetching " + addr + ": " + response.status)
        this.setState("info.connection", false, true);
        return undefined
      }
    } catch (err) {
      this.log.error("Fatal error during fetch " + err)
      this.setState("info.connection", false, true);
      return undefined
    }
  }


}

if (module.parent) {
  // Export the constructor in compact mode
  module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new MystromSwitch(options);
} else {
  // otherwise start the instance directly
  (() => new MystromSwitch())();
}