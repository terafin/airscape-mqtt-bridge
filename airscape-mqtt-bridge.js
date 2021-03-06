// Requirements
const mqtt = require('mqtt')
const logging = require('homeautomation-js-lib/logging.js')
const airscape = require('./lib/airscape.js')
const _ = require('lodash')
const health = require('homeautomation-js-lib/health.js')
const mqtt_helpers = require('homeautomation-js-lib/mqtt_helpers.js')

var shouldRetain = process.env.MQTT_RETAIN

if (_.isNil(shouldRetain)) {
    shouldRetain = true
}

var mqttOptions = { qos: 1 }

if (!_.isNil(shouldRetain)) {
    mqttOptions['retain'] = shouldRetain
}

// Config
const set_string = '/set'
const airscapeTopic = process.env.TOPIC_PREFIX

if (_.isNil(airscapeTopic)) {
    logging.error('TOPIC_PREFIX not set, not starting')
    process.abort()
}

var connectedEvent = function() {
    client.subscribe(airscapeTopic + set_string, { qos: 1 })
    health.healthyEvent()
}

var disconnectedEvent = function() {
    health.unhealthyEvent()
}

// Setup MQTT
var client = mqtt_helpers.setupClient(connectedEvent, disconnectedEvent)

client.on('message', (topic, message) => {
    if (_.isNil(message) || _.isNil(topic)) {
        return
    }

    airscape.setSpeed(parseInt(message))
    health.healthyEvent()
})

airscape.on('fan-updated', (result) => {
    if (_.isNil(result)) {
        logging.error('Airscape update failed')
        health.unhealthyEvent()
        return
    }

    const changedKeys = Object.keys(result)
    logging.info('Airscape updated: ' + changedKeys)

    if (_.isNil(changedKeys)) {
        health.unhealthyEvent()
    } else {
        health.healthyEvent()
    }

    changedKeys.forEach(
        function(this_key) {
            if (this_key === 'server_response') {
                return
            }

            const value = result[this_key]

            if (_.isNil(value)) {
                return
            }

            if (this_key === 'fanspd') {
                client.smartPublish(airscapeTopic, '' + value, mqttOptions)
            } else {
                client.smartPublish(airscapeTopic + '/' + this_key, '' + value, mqttOptions)
            }
        }
    )
})