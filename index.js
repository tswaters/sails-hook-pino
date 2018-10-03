
'use strict'

const util = require('util')
const pino = require('pino')
const uuid = require('uuid')
const _ = require('lodash')

const colors = require('colors/safe')
const defaults = require('./defaults')

module.exports = function SailsHookPino (sails) {

  let logger = null

  /**
   * Crates a new instance of a logger that looks like something sails expects
   * Sails expects a function (log.debug) with the levels as static methods on top of it.
   * Also throw in the ship there for the heck of it.
   * @param {*} logger 
   */
  function createLogger (logger) {
    let ship = () => {}

    try {ship = require('sails/lib/hooks/logger/ship')(sails.version, logger.info.bind(logger))} catch (e) {/*ignore*/}

    return Object.defineProperties(
      logger._debug.bind(logger), 
      {
        crit: {value: logger.fatal.bind(logger), enumerable: true},
        error: {value: logger.error.bind(logger), enumerable: true},
        warn: {value: logger.warn.bind(logger), enumerable: true},
        debug: {value: logger._debug.bind(logger), enumerable: true},
        info: {value: logger.info.bind(logger), enumerable: true},
        blank: {value: logger.blank.bind(logger), enumerable: true},
        verbose: {value: logger.debug.bind(logger), enumerable: true},
        silly: {value: logger.trace.bind(logger), enumerable: true},
        ship: {value: ship, enumerable: true}
      }
    )
  }

  /**
   * Returns the level that pino knows about from something sails passes
   * @param {string} level 
   */
  function getPinoLevel (level) {
    let actualLevel = null
    switch (level) {
      case 'crit': actualLevel = 'fatal'; break
      case 'debug': actualLevel = '_debug'; break
      case 'verbose': actualLevel = 'debug'; break
      case 'silly': actualLevel = 'trace'; break
      default: actualLevel = level
    }
    return actualLevel
  }

  /**
   * Returns the level that sails knows about from something pino passes
   * @param {*} level 
   */
  function getSailsLevel (level) {
    let actualLevel = null
    switch (level) {
      case 'fatal': actualLevel = 'crit'; break
      case '_debug': actualLevel = 'debug'; break
      case 'debug': actualLevel = 'verbose'; break
      case 'trace': actualLevel = 'silly'; break
      default: actualLevel = level
    }
    return actualLevel
  }

  return {

    defaults: {
      __configKey__: {
        pino: null,
        sails: false,
        pretty: false
      }
    },

    instance: () => logger,

    /**
     * Creates something that looks like a sails logger (e.g., with silly)
     * This passes along context to create a child pino logger
     */
    createChild: (context) => createLogger(logger.createChild(context)),

    getPinoLevel,

    getSailsLevel,

    initialize (cb) {
      
      const config = sails.config.pino
      let transform = process.stdout
      
      if (config.pretty) {

        // allow passing pretty options to formatter
        transform = pino.pretty(config.pretty)
        transform.pipe(process.stdout)

      } else if (config.sails) {
        
        // replicate default sails logging.
        const theme = config.sails.colors || defaults.colors
        const prefixes = config.sails.prefixes || defaults.prefixes
        const inspectOptions = sails.config.log.inspectOptions || {}
        
        transform = pino.pretty({
          formatter (msg) {
            const key = getSailsLevel(logger.levels.labels[msg.level])
            const prefix = prefixes[key]
            const color = theme[key]
            const preamble = colors[color](prefix)
            const message = msg.msg || ''

            // figure out if we have additional meta to include (i.e. req/res logging)
            let extra = ''
            const meta = _.omit(msg, ['pid', 'hostname', 'name', 'level',  'time', 'v', 'msg'])
            if (Object.keys(meta).length > 0) {
              const pieces = []
              _.each(meta, arg => pieces.push(util.inspect(arg, inspectOptions)))
              extra = util.format.apply(util, pieces) 
            }

            return preamble + message + extra
          }
        })
        transform.pipe(process.stdout)
      }

      // create logger with some additional levels to map to sails properly
      logger = pino(config.pino, transform)
      logger.addLevel('_debug', 35) // _debug = debug which in sails is > info[30] < warn[40]
      logger.addLevel('blank', 31) // blank = info; returns a blank string (for pretty printing)
      logger.level = getPinoLevel(sails.config.log.level)
      sails.log = createLogger(logger)

      cb()
    },

    requestLogger (getTransactionId) {

      if (!getTransactionId) {
        getTransactionId = () => uuid.v4()
      }

      return (req, res, next) => {
        const child = logger.child({
          transactionId: getTransactionId(req, res),
          serializers: {
            req: pino.stdSerializers.req,
            res: pino.stdSerializers.res
          }
        })
        req.log = createLogger(child)
        next()  
      }
    }

  }

}
