var API, defaults, _,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

_ = require('lodash');

defaults = _.partialRight(_.merge, _.defaults);

API = (function() {
  function API(options) {
    this.init = __bind(this.init, this);
    this._event = __bind(this._event, this);
    var method, q, _i, _len, _ref;
    this.name_space = options.name_space;
    this.collection_name = options.collection_name;
    this.model = options.model;
    this.use_stream = options.use_stream || false;
    this.stream = void 0;
    this.stream_query = options.stream_query || {};
    this.default_query = options.default_query || {};
    if (this.default_query["default"]) {
      _ref = ['create', 'update', 'remove', 'find', 'count'];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        method = _ref[_i];
        if (method in this.default_query) {
          q = this.default_query[method];
          defaults(q, this.default_query["default"]);
        } else {
          this.default_query[method] = this.default_query["default"];
        }
      }
    }
  }

  API.prototype._event = function(name) {
    return this.collection_name + " " + name;
  };

  API.prototype.init = function(io) {
    var conditions,
      _this = this;
    this.io = io;
    this.channel = this.io.of('/socket_api_' + this.name_space);
    if (this.use_stream) {
      conditions = {};
      if (this.default_query.find) {
        conditions = this.default_query.find.conditions;
      }
      this.stream = this.model.find(conditions).tailable().stream();
      this.stream.on('data', function(doc) {
        return _this.channel.emit(_this._event('update'), {
          method: 'stream',
          docs: [doc]
        });
      });
    }
    return this.channel.on('connection', function(socket) {
      socket.on(_this._event('create'), function(data, ack_cb) {
        var doc;
        if (_this.default_query.create) {
          doc = defaults(data.doc, _this.default_query.create.doc);
        } else {
          doc = data.doc;
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
        if (_this.default_query.update) {
          conditions = defaults(data.conditions || {}, _this.default_query.update.conditions);
          update = defaults(data.update || {}, _this.default_query.update.update);
          options = defaults(data.options || {}, _this.default_query.update.options);
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
        if (_this.default_query.remove) {
          conditions = defaults(data.conditions || {}, _this.default_query.remove.conditions);
        } else {
          conditions = data.conditions;
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
        var fields, options;
        if (_this.default_query.find) {
          conditions = defaults(data.conditions || {}, _this.default_query.find.conditions);
          fields = defaults(data.fields || {}, _this.default_query.find.fields);
          options = defaults(data.options || {}, _this.default_query.find.options);
        } else {
          conditions = data.conditions;
          fields = data.fields;
          options = data.options;
        }
        return _this.model.find(conditions, fields, options, function(err, docs) {
          return ack_cb(err, docs);
        });
      });
      return socket.on(_this._event('count'), function(data, ack_cb) {
        if (_this.default_query.count) {
          conditions = defaults(data.conditions || {}, _this.default_query.count.conditions);
        } else {
          conditions = data.conditions;
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
