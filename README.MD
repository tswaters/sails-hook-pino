# Sails Hook Pino

Sails hook for pino logging

## Install

```sh
npm install sails-hook-pino
```

## A note on initialization

The order in which sails spins up user-defined hooks means that this logger will only initialize after most of the hooks have already been loaded. To get consistent logging output, it is recommended you disable the built-in logger hook. In `.sailsrc`:

```
{
  "hooks": {
    "logger": false
  }
}
```

With this setup, during initialization, `sails.log` will be a simple logger that will return errors and debug statements... in practice, with `level=silly` unlress there are errors during setup, sails will be silent until the pino logger hook is enabled.  Once this hook has been loaded, you will start getting log statements.

## API

All these methods can be accessed from `sails.hooks.pino`

* `instance` - function() => PinoLogger: call to receive the base logger instance

* `createChild` - function(context) => SailsLogger: call to create a pino child that looks like the sails logger

* `getPinoLevel` - function(string) => string: pass a logging level from sails to get the level in pino

* `getSailsLevel` - function(string) => string: pass a logging level from pino to get hte level in sails

* `requestLogger` - function (key) => function(req, res, next): middleware to initialize `req.log`

## Request logging

You can setup a child request logger under `req.log` with additional meta information.
You can provide a `transactionId` meta parameter from the (req, res) parameters; uuid.v4() will be used by default
This child logger has the pino `req/res` serializers installed so you can pass `req` or `res` as the first parameter

* ./config/http.js

```js
exports.http = {
  middleware: {

    initializeLogger: (req, res, next) => {
      const getTransactionKey = (req, res) => req.session.id
      sails.hooks.pino.requestLogger(getTransactionKey)(req, res, next)
    },

    logAllTheThings: (req, res, next) => {
      req.log(req)
      next()
    },

    order: [
      ...etc...
      initializeLogger, // place before `router`
      logAllTheThings // optional, use to log requests
      ...etc...
    ]
  }
}
```

* ./api/controllers/SomeController.js
```js
exports.SomeAction = (req, res, next) => {
  req.log.info('A user has visited some action') // will log this message with `transactionId` requal to user's session id.
}
```

* ./api/responses/notOk.js

```js
module.exports = err => {
  res.status(err.status)
  res.end(err.message)
  req.log(res) // log response for errors
}
```

* ./api/respones/ok.js

```js
module.exports = (data, options) => {
  if (req.wantsJSON) {
    res.json(data)
  } else {
    res.view(options, data)
  }
  res.log(res)
}

```

## Configuration

This module will pick up certain configuration options passed to `sails.config.log`:

* `level` - default: "info"; {string} - level to log

* `inspectOptions` - default {}; {object} - for `sails` printing; options to pass to `util.inspect`. For request logging, these will be run through `util.inspect` when sails logging is enabled.

Other options are passed via `sails.config.pino`:

* `sails` - default: false; {boolean|object} - pass `true` to replicate the look/feel of the build-in sails logger. You can pass additional options as well.

* `sails.colors` - the colors to use for the different levels.

* `sails.prefixes` - prefixes to prepend to log messages

* `pretty` - default: false; {boolean|object} - pass true to use pino's `pretty` output. Passing an object will pass the options to `pino.pretty()` see: [API documentation](https://github.com/pinojs/pino/blob/v4.7.1/docs/API.md#pretty)

* `pino` - default: null; {object|null} - pass an object, this will be passed to the `pino` constructor see: [API Documentation](https://github.com/pinojs/pino/blob/v4.7.1/docs/API.md#constructor)


## Sample configuration

```js
exports.pino = {
  /*
  pino: {
    // pino constructor options here
    // https://github.com/pinojs/pino/blob/v4.7.1/docs/API.md#constructor
  },
  pretty: {
    // pino pretty options here
    // https://github.com/pinojs/pino/blob/v4.7.1/docs/API.md#pretty
  },

  // this can be `true` to use same defaults that sails uses.
  sails: {
    colors: {
      silly: 'rainbow',
      verbose: 'cyan',
      debug: 'blue',
      info: 'green',
      blank: 'white',
      warn: 'yellow',
      error: 'red',
      crit: 'red'
    },
    prefixes: {
      silly: 'silly: ',
      verbose: 'verbose: ',
      info: 'info: ',
      blank: '',
      debug: 'debug: ',
      warn: 'warn: ',
      error: 'error: ',
      crit: 'CRITICAL: '
    }
  }
  */
}
```
## License

MIT
