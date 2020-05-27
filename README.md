# homebridge-remote-control
Homebridge plugin to control remote control(s) using Raspberry Pi (or similar) output pin(s)

Sample config:

"Platforms": [{
    "platform": "HomebridgeRemoteControlPlugin",
    "accessories": [{
        "name": "Gate", // unique name
        "pin": 26, // the pin to turn on / off
        "delay": 10 // optional delay before gate / garage toggle the state between open and close in seconds. Default is 10
    }]
}]
