var API, async, _, _defaults,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

_ = require('lodash');

_defaults = _.partialRight(_.merge, _.defaults);

async = require('async');

API = (function() {
  function API(options) {
    this.init = __bind(this.init, this);
    this.check_middleware = __bind(this.check_middleware, this);
    this.update = __bind(this.update, this);
    this._event = __bind(this._event, this);
    this.name_space = options.name_space;
    this.collection_name = options.collection_name;
    this.model = options.model;
    this.use_stream = options.use_stream || false;
    this.stream = void 0;
    this.limit = options.limit || 10;
    this["default"] = options["default"] || {};
    this.middlewares = options.middlewares || {};
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
      if (_.isFunction(this.middlewares['default'])) {
        data = this.middlewares['default'](data);
      } else {
        _ref = this.middlewares['default'];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          middleware = _ref[_i];
          data = middleware(data);
        }
      }
    }
    if (this.middlewares[method] != null) {
      if (_.isFunction(this.middlewares[method])) {
        data = this.middlewares[method](data);
      } else {
        _ref1 = this.middlewares[method];
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          middleware = _ref1[_j];
          data = middleware(data);
        }
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
      conditions = this["default"].conditions || {};
      this.stream = this.model.find(conditions).tailable().stream();
      this.stream.on('data', function(doc) {
        return _this.update('stream', [doc]);
      });
    }
    return this.channel.on('connection', function(socket) {
      socket.on(_this._event('create'), function(data, ack_cb) {
        var doc;
        data = _this.check_middleware('create', data);
        doc = data.doc || _this["default"].doc || {};
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
        conditions = data.conditions || _this["default"].conditions || {};
        update = data.update || _this["default"].update || {};
        options = data.options || _this["default"].options || {};
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
        conditions = data.conditions || _this["default"].conditions || {};
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
      socket.on(_this._event('findOne'), function(data, ack_cb) {
        var fields, options;
        data = _this.check_middleware('find', data);
        conditions = data.conditions || _this["default"].conditions || {};
        fields = data.fields || _this["default"].fields || {};
        options = data.options || _this["default"].options || {};
        return _this.model.findOne(conditions, fields, options, function(err, doc) {
          return ack_cb(err, doc);
        });
      });
      socket.on(_this._event('find'), function(data, ack_cb) {
        var fields, limit, options, page;
        data = _this.check_middleware('find', data);
        conditions = data.conditions || _this["default"].conditions || {};
        fields = data.fields || _this["default"].fields || {};
        options = data.options || _this["default"].options || {};
        page = data.page || 0;
        limit = _this.limit;
        options['limit'] = _this.limit;
        options['skip'] = page * _this.limit;
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
        array = data.array || _this["default"].array || {};
        options = data.options || _this["default"].options || {};
        return _this.model.aggregate(array, options, function(err, docs) {
          return ack_cb(err, docs);
        });
      });
      return socket.on(_this._event('count'), function(data, ack_cb) {
        data = _this.check_middleware('count', data);
        conditions = data.conditions || _this["default"].conditions || {};
        return _this.model.count(conditions, function(err, count) {
          return ack_cb(err, count);
        });
      });
    });
  };

  return API;

})();

module.exports = API;
