var
  util         = require('./util'),
  EventEmitter = require('events').EventEmitter,
  Q            = require('./q'),
  when         = Q.when,
  inherits     = require('util').inherits,
  slice        = Array.prototype.slice,
  _            = require('underscore'),
  Injector     = require('bogart-injector'),
  Request      = require('./request');

var
  httpMethod = {
    GET: "get",
    POST: "post",
    PUT: "put",
    DELETE: "delete"
  },
  restMethod = {
    SHOW: httpMethod.GET,
    CREATE: httpMethod.POST,
    UPDATE: httpMethod.PUT,
    DESTROY: httpMethod.DELETE
  },
  PATH_PARAMETER_REPLACEMENT = "([^\/\?]+)",
  PATH_PARAMETERS = /:([\w\d]+)/g;

exports.bogartEvent = {
  BEFORE_ADD_ROUTE: "beforeAddRoute",
  AFTER_ADD_ROUTE: "afterAddRoute"
};

function defaultNotFoundCallback(req) {
  var body = 'Not Found';
  if (req.pathInfo) {
    body += ': ' + req.pathInfo;
  }
  
  return {
    status: 404,
    body: [body],
    headers: { 'Content-Length': Buffer.byteLength(body, 'utf-8'), 'Content-Type': 'text/html' }
  };
}

exports.Router = Router;
function Router(notFoundCallback) {
  if (!this.respond) {
    return new Router(notFoundCallback);
  }

  var settings = {}

  var app = function (injector) {
    if (!injector.has('req')) {
      throw new Error('Bogart Router requires an injector ' + 
        'with a request dependency registered under key `req`');
    }

    injector.value('req', new Request(injector.resolve('req')));

    return app.respond(injector);
  };

  app.routes = {};
  app.beforeCallbacks = [];
  app.afterCallbacks = [];
  app.notFoundCallback = notFoundCallback || defaultNotFoundCallback;

  app.setting = function(name, val) {
    if (val === undefined) {
      return settings[name];
    }

    settings[name] = val;
    return this;
  };

  EventEmitter.call(app);

  _.extend(app, this.__proto__);

  return app;
}

inherits(Router, EventEmitter);

/**
 * Register a callback to happen before bogart handlers are invoked to
 * handle a request.  Multiple 'before' callbacks may be registered.
 *
 * @param {Function} cb   Callback to happen before route handler is invoked.
 */
Router.prototype.before = function(cb) {
  this.beforeCallbacks.push(cb);
};

/**
 * Register a callback to happen after bogart handlers are invoked to
 * handle a request.  Multiple 'after' callbacks may be registered.
 *
 * @param {Function} cb   Callback to happen after route handler is invoked.
 */
Router.prototype.after = function(cb) {
  this.afterCallbacks.push(cb);
};

/**
  * Register a route
  * @param {String} method Http Verb e.g. 'GET', 'POST', 'PUT', 'DELETE'
  * @param {String} path Path for the route
  * @param {Function} handler Function to execute when the route is accessed
  */
Router.prototype.route = function(method, path /*, handlers... */) {
  var paramNames, route, originalPath = path
    , args = slice.call(arguments);
  
  method = args.shift();
  path = args.shift();
  apps = args;

  if (path.constructor === String) {
    paramNames = path.match(PATH_PARAMETERS) || [];
    paramNames = paramNames.map(function(x) { return x.substring(1); });

    path = new RegExp("^"+path.replace(/\./, '\\.').replace(/\*/g, '(.+)').replace(PATH_PARAMETERS, PATH_PARAMETER_REPLACEMENT)+'$');
  }

  route = makeRoute({ path: path, paramNames: paramNames, apps: apps, originalPath: originalPath });

  this.emit(exports.bogartEvent.BEFORE_ADD_ROUTE, this, route);

  this.routes[method] = this.routes[method] || [];
  this.routes[method].push(route);

  this.emit(exports.bogartEvent.AFTER_ADD_ROUTE, this, route);

  return this;
};

Router.prototype.handler = function(verb, path) {
  verb = verb.toLowerCase();
  var route;

  if (this.routes[verb]) {
    for (var i=0;i<this.routes[verb].length;i++) {
      route = this.routes[verb][i];
      if (path.match(route.path) || decodeURIComponent(path).match(route.path)) {
        return route;
      }
    }
  }

  if (path === '') {
    return this.handler(verb, '/');
  }

  return null;
};

Router.prototype.respond = function (injector) {
  var self = this
    , noRouteMatchesReason = 'No route matches request'
    , req = injector.resolve('req')
    , route = self.handler(req.method, req.pathInfo);

  if (util.no(route)) {
    return injector.invoke(this.notFoundCallback);
  }

  route.bindRouteParametersToRequest(req);

  var allBefores = Q.all(self.beforeCallbacks.map(function(cb) { return cb(req) }));

  return allBefores
    .then(function() {
      var stackApps = stack(injector, route.apps);

      return stackApps(req)
    })
    .then(function(resp) {
      var allAfters = Q.all(self.afterCallbacks.map(function(cb) { return cb(req); }));

      return allAfters.then(thenResolve(resp));
    })
    .then(function(resp) {
      if (util.no(resp)) {
        return injector.invoke(self.notFoundCallback);
      }

      return resp;
    });
};

Router.prototype.show = Router.prototype.get = function(path /*, jsgiApps */) {
  return this.route.apply(this, [ restMethod.SHOW ].concat(slice.call(arguments)));
};

Router.prototype.create = Router.prototype.post = function(path /*, jsgiApps */) {
  return this.route.apply(this, [ restMethod.CREATE ].concat(slice.call(arguments)));
};

Router.prototype.update = Router.prototype.put = function(path /*, jsgiApps */) {
  return this.route.apply(this, [ restMethod.UPDATE ].concat(slice.call(arguments)));
};

Router.prototype.destroy = Router.prototype.del = function(path /*, jsgiApps */) {
  return this.route.apply(this, [ restMethod.DESTROY ].concat(slice.call(arguments)));
};

/**
 * Register a callback to be invoked when there is no callback
 * registered for a route or when a callback for a route returns
 * no response.
 */
Router.prototype.notFound = function (callback) {
  this.notFoundCallback = callback;
};

Router.prototype.isRouter = true;

/**
 * Takes a variadic number of JSGI applications and chains them together.
 *
 * @param {Injector} injector
 * @param {Array} array of apps
 * @returns {Function} A function that takes a request and executes a stack of JSGI applications.
 */
function stack(injector, apps) {
  if (apps.length === 0) {
    return function (req) {
      return undefined;
    }
  }

  apps = apps.concat();

  function next(req) {
    var reqInjector = injector.createChild();
    reqInjector.value('req', req);
    reqInjector.value('next', next);
    reqInjector.value('nextApp', next);

    var app = apps.shift();

    res = reqInjector.invoke(app);

    var depth = 0;
    while (typeof res === 'function') {
      res = reqInjector.invoke(res);
      depth += 1;
      if (depth === 3) {
        throw new Error('Maximum depth exceeded');
      }
    }

    return res;
  }

  return function(req) {
    return next(req);
  };
}

function getParameterNames(fn) {
  var source = fn.toString();

  var signature = source.slice(source.indexOf('(') + 1, source.indexOf(')'));

  return signature.match(/([^\s,]+)/g);
}

exports.stack = stack;

/**
 * Returns a function that returns @param val.
 *
 * @param val The value to return
 * @returns {Function} A function that returns `val`.
 */
function thenResolve(val) {
  return function() {
    return val;
  }
}

function makeRoute(proto) {
  return Object.create(proto, {
    bindRouteParametersToRequest: {
      value: function(req) {
        var route = this
          , routeParamValues = route.path.exec(req.pathInfo);

        if (routeParamValues) {
          routeParamValues.shift(); // Remove the initial match

          routeParamValues
            .map(decodeURIComponent)
            .forEach(function(val, indx) {
              if (route.paramNames && route.paramNames.length > indx) {
                req.routeParams[route.paramNames[indx]] = val;
              } else if (val !== undefined) {
                req.routeParams.splat = req.routeParams.splat || [];
                req.routeParams.splat.push(val);
              }
            });
        }        
      }
    }
  });
}