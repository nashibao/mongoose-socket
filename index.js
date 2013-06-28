var API,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

API = (function() {
  function API(options) {
    this.init = __bind(this.init, this);
    this._event = __bind(this._event, this);
    this.name_space = options.name_space;
    this.collection_name = options.collection_name;
    this.model = options.model;
    this.use_stream = options.use_stream || false;
    this.stream = void 0;
  }

  API.prototype._event = function(name) {
    return this.collection_name + " " + name;
  };

  API.prototype.init = function(io) {
    var _this = this;
    this.io = io;
    this.channel = this.io.of('/socket_api_' + this.name_space);
    if (this.use_stream) {
      this.stream = this.model.find().tailable().stream();
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
        doc = data.doc;
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
        var conditions, options, update;
        conditions = data.conditions;
        update = data.update;
        options = data.options;
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
        var conditions;
        conditions = data.conditions;
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
        var conditions, fields, options;
        conditions = data.conditions;
        fields = data.fileds;
        options = data.options;
        return _this.model.find(conditions, fields, options, function(err, docs) {
          return ack_cb(err, docs);
        });
      });
      return socket.on(_this._event('count'), function(data, ack_cb) {
        var conditions;
        conditions = data.conditions;
        return _this.model.count(conditions, function(err, count) {
          return ack_cb(err, count);
        });
      });
    });
  };

  return API;

})();

module.exports = API;
