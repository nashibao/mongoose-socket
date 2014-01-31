var Storage,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

Storage = (function() {
  function Storage(options) {
    if (options == null) {
      options = {};
    }
    this.init = __bind(this.init, this);
    this._event = __bind(this._event, this);
    this.name_space = options.name_space || '';
    this.handshake_parameter_name = options.handshake_parameter_name || '_session';
    this.get = options.get || function(socket, data, cb) {
      return cb(null, socket.handshake[this.handshake_parameter_name]);
    };
    this.set = options.set || function(socket, data, cb) {
      socket.handshake[this.handshake_parameter_name] = data;
      return cb(null);
    };
  }

  Storage.prototype._event = function(name) {
    return name;
  };

  Storage.prototype.init = function(io) {
    this.io = io;
    this.channel = this.io.of('/socket_api_storage_' + this.name_space);
    return this.channel.on('connection', (function(_this) {
      return function(socket) {
        socket.on(_this._event('get'), function(data, ack_cb) {
          return _this.get(socket, data, function(err, doc) {
            return ack_cb(err, doc);
          });
        });
        return socket.on(_this._event('set'), function(data, ack_cb) {
          return _this.set(socket, data, function(err) {
            return ack_cb(err);
          });
        });
      };
    })(this));
  };

  return Storage;

})();

module.exports = Storage;
