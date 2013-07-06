var API, async, copy, defaults, _, _defaults,
  _this = this,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

_ = require('lodash');

_defaults = _.partialRight(_.merge, _.defaults);

async = require('async');

copy = function(d) {
  var k, temp;
  temp = {};
  for (k in d) {
    if (_.isFunction(d[k])) {
      temp[k] = d[k];
    } else if (_.isObject(d[k])) {
      temp[k] = copy(d[k]);
    } else {
      temp[k] = d[k];
    }
  }
  return temp;
};

defaults = function(d1, d2) {
  var _d1;
  if (d1 == null) {
    return d2;
  }
  _d1 = copy(d1);
  return _defaults(_d1, d2);
};

API = (function() {
  function API(options) {
    this.init = __bind(this.init, this);
    this.check_middleware = __bind(this.check_middleware, this);
    this.update = __bind(this.update, this);
    this._event = __bind(this._event, this);
    var method, q, _i, _j, _len, _len1, _ref, _ref1;
    this.name_space = options.name_space;
    this.collection_name = options.collection_name;
    this.model = options.model;
    this.use_stream = options.use_stream || false;
    this.stream = void 0;
    this.limit = options.limit || 10;
    this.stream_query = options.stream_query || {};
    this.default_query = options.default_query || {};
    this.overwrite_query = options.overwrite_query || {};
    this.middlewares = options.middlewares || {};
    if (this.default_query["default"] != null) {
      _ref = ['create', 'update', 'remove', 'find', 'count'];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        method = _ref[_i];
        if (method in this.default_query) {
          q = this.default_query[method];
          _defaults(q, this.default_query["default"]);
        } else {
          q = this.default_query[method] = this.default_query["default"];
        }
      }
    }
    if (this.overwrite_query["default"] != null) {
      _ref1 = ['create', 'update', 'remove', 'find', 'count'];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        method = _ref1[_j];
        if (method in this.overwrite_query) {
          q = this.overwrite_query[method];
          _defaults(q, this.overwrite_query["default"]);
        } else {
          this.overwrite_query[method] = this.overwrite_query["default"];
        }
      }
    }
  }

  API.prototype._event = function(name) {
    return this.collection_name + " " + name;
  };

  API.prototype.update = function(method, docs) {
    return this.channel.emit(this._event('update'), {
      method: method,
      docs: docs
    });
  };

  API.prototype.check_middleware = function(method, data) {
    var middleware, _i, _j, _len, _len1, _ref, _ref1;
    if (this.middlewares['default'] != null) {
      _ref = this.middlewares['default'];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        middleware = _ref[_i];
        data = middleware(data);
      }
    }
    if (this.middlewares[method] != null) {
      _ref1 = this.middlewares[method];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        middleware = _ref1[_j];
        data = middleware(data);
      }
    }
    return data;
  };

  API.prototype.init = function(io) {
    var conditions,
      _this = this;
    this.io = io;
    this.channel = this.io.of('/socket_api_' + this.name_space);
    if (this.use_stream) {
      conditions = {};
      if (this.default_query.find != null) {
        conditions = this.default_query.find.conditions;
      }
      if (this.overwrite_query.find != null) {
        conditions = defaults(this.overwrite_query.find.conditions, conditions);
      }
      this.stream = this.model.find(conditions).tailable().stream();
      this.stream.on('data', function(doc) {
        return _this.update('stream', [doc]);
      });
    }
    return this.channel.on('connection', function(socket) {
      socket.on(_this._event('create'), function(data, ack_cb) {
        var doc;
        data = _this.check_middleware('create', data);
        if (_this.default_query.create != null) {
          doc = defaults(data.doc, _this.default_query.create.doc);
        } else {
          doc = data.doc;
        }
        if (_this.overwrite_query.create != null) {
          doc = defaults(_this.overwrite_query.create.doc, doc);
        }
        return _this.model.create(doc, function(err) {
          ack_cb(err);
          if (!err) {
            if (!_this.use_stream) {
              return _this.channel.emit(_this._event('update'), {
                method: 'create',
                docs: [doc]
              });
            }
          }
        });
      });
      socket.on(_this._event('update'), function(data, ack_cb) {
        var options, update;
        data = _this.check_middleware('update', data);
        if (_this.default_query.update != null) {
          conditions = defaults(data.conditions, _this.default_query.update.conditions);
          update = defaults(data.update, _this.default_query.update.update);
          options = defaults(data.options, _this.default_query.update.options);
        }
        if (_this.overwrite_query.update != null) {
          conditions = defaults(_this.overwrite_query.update.conditions, conditions);
          update = defaults(_this.overwrite_query.update.update, update);
          options = defaults(_this.overwrite_query.update.options, options);
        }
        return _this.model.update(conditions, update, options, function(err, numberAffected, raw) {
          ack_cb(err, numberAffected, raw);
          if (!err) {
            return _this.channel.emit(_this._event('update'), {
              method: 'update',
              numberAffected: numberAffected,
              raw: raw
            });
          }
        });
      });
      socket.on(_this._event('remove'), function(data, ack_cb) {
        data = _this.check_middleware('remove', data);
        if (_this.default_query.remove != null) {
          conditions = defaults(data.conditions, _this.default_query.remove.conditions);
        } else {
          conditions = data.conditions;
        }
        if (_this.overwrite_query.remove != null) {
          conditions = defaults(_this.overwrite_query.remove.conditions, conditions);
        }
        return _this.model.remove(conditions, function(err) {
          ack_cb(err);
          if (!err) {
            return _this.channel.emit(_this._event('update'), {
              method: 'remove',
              conditions: conditions
            });
          }
        });
      });
      socket.on(_this._event('find'), function(data, ack_cb) {
        var fields, limit, options, page;
        data = _this.check_middleware('find', data);
        if (_this.default_query.find != null) {
          conditions = defaults(data.conditions, _this.default_query.find.conditions);
          fields = defaults(data.fields, _this.default_query.find.fields);
          options = defaults(data.options, _this.default_query.find.options);
        } else {
          conditions = data.conditions;
          fields = data.fields;
          options = data.options;
        }
        page = data.page || 0;
        limit = _this.limit;
        options = options || {};
        options['limit'] = _this.limit;
        options['skip'] = page * _this.limit;
        if (_this.overwrite_query.find != null) {
          conditions = defaults(_this.overwrite_query.find.conditions, conditions);
          fields = defaults(_this.overwrite_query.find.fields, fields);
          options = defaults(_this.overwrite_query.find.options, options);
        }
        return async.parallel([
          function(cb) {
            return _this.model.count(conditions, cb);
          }, function(cb) {
            return _this.model.find(conditions, fields, options, cb);
          }
        ], function(err, results) {
          var cnt, docs;
          cnt = results[0];
          docs = results[1];
          options = {};
          options.count = cnt;
          options.page = page;
          options.limit = limit;
          options.page_length = Math.ceil(cnt / limit);
          return ack_cb(err, docs, options);
        });
      });
      socket.on(_this._event('aggregate'), function(data, ack_cb) {
        var array, options;
        data = _this.check_middleware('aggregate', data);
        if (_this.default_query.aggregate != null) {
          array = defaults(data.array, _this.default_query.aggregate.array);
          options = defaults(data.options, _this.default_query.aggregate.options);
        } else {
          array = data.array;
          options = data.options;
        }
        if (_this.overwrite_query.aggregate != null) {
          array = defaults(_this.overwrite_query.aggregate.array, array);
          options = defaults(_this.overwrite_query.aggregate.options, options);
        }
        return _this.model.aggregate(array, options, function(err, docs) {
          return ack_cb(err, docs);
        });
      });
      return socket.on(_this._event('count'), function(data, ack_cb) {
        data = _this.check_middleware('count', data);
        if (_this.default_query.count != null) {
          conditions = defaults(data.conditions, _this.default_query.count.conditions);
        } else {
          conditions = data.conditions;
        }
        if (_this.overwrite_query.count != null) {
          conditions = defaults(_this.overwrite_query.count.conditions, conditions);
        }
        return _this.model.count(conditions, function(err, count) {
          return ack_cb(err, count);
        });
      });
    });
  };

  return API;

})();

module.exports = API;
