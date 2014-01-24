var API, async, _, _defaults,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

_ = require('lodash');

_defaults = _.partialRight(_.merge, _.defaults);

async = require('async');

API = (function() {
  function API(options) {
    if (options == null) {
      options = {};
    }
    this.init = __bind(this.init, this);
    this._middle = __bind(this._middle, this);
    this.update = __bind(this.update, this);
    this._event = __bind(this._event, this);
    this.use = __bind(this.use, this);
    this.name_space = options.name_space || '';
    this.collection_name = options.collection_name || '';
    this.model = options.model || false;
    this.use_stream = options.use_stream || false;
    this.limit = options.limit || 10;
    this._middlewares = options.middlewares || [];
    this.stream = false;
  }

  API.prototype.use = function(middleware) {
    return this._middlewares.push(middleware);
  };

  API.prototype._event = function(name) {
    return this.collection_name + " " + name;
  };

  API.prototype.update = function(method, docs) {
    return this.channel.emit(this._event('update'), {
      method: method,
      docs: docs
    });
  };

  API.prototype._middle = function(method, data, socket) {
    var bl, mw, _i, _len, _ref;
    bl = true;
    _ref = this._middlewares;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      mw = _ref[_i];
      bl = bl && mw(method, data, socket);
    }
    return bl;
  };

  API.prototype.init = function(io) {
    var _this = this;
    this.io = io;
    this.channel = this.io.of('/socket_api_' + this.name_space);
    if (this.use_stream) {
      this.stream = this.model.find({}).tailable().stream();
      this.stream.on('data', function(doc) {
        return _this.update('stream', [doc]);
      });
    }
    return this.channel.on('connection', function(socket) {
      socket.on(_this._event('create'), function(data, ack_cb) {
        var doc;
        if (!_this._middle('create', data, socket)) {
          return ack_cb('_middle error');
        }
        if (!(data.doc != null)) {
          return ack_cb('no doc parameter');
        }
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
        if (!_this._middle('update', data, socket)) {
          return ack_cb('_middle error');
        }
        conditions = data.conditions || {};
        update = data.update || {};
        options = data.options || {};
        options["new"] = true;
        return _this.model.findOneAndUpdate(conditions, update, options, function(err, ndoc) {
          ack_cb(err, ndoc);
          if (!err) {
            return _this.channel.emit(_this._event('update'), {
              method: 'update',
              doc: ndoc
            });
          }
        });
      });
      socket.on(_this._event('remove'), function(data, ack_cb) {
        var conditions;
        if (!_this._middle('remove', data, socket)) {
          return ack_cb('_middle error');
        }
        conditions = data.conditions || {};
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
        var conditions, fields, options;
        if (!_this._middle('findOne', data, socket)) {
          return ack_cb('_middle error');
        }
        conditions = data.conditions || {};
        fields = data.fields || {};
        options = data.options || {};
        return _this.model.findOne(conditions, fields, options, function(err, doc) {
          return ack_cb(err, doc);
        });
      });
      socket.on(_this._event('find'), function(data, ack_cb) {
        var conditions, fields, limit, options, page;
        if (!_this._middle('find', data, socket)) {
          return ack_cb('_middle error');
        }
        conditions = data.conditions || {};
        fields = data.fields || {};
        options = data.options || {};
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
        if (!_this._middle('aggregate', data, socket)) {
          return ack_cb('_middle error');
        }
        array = data.array || {};
        options = data.options || {};
        return _this.model.aggregate(array).exec(function(err, docs) {
          return ack_cb(err, docs);
        });
      });
      return socket.on(_this._event('count'), function(data, ack_cb) {
        var conditions;
        if (!_this._middle('count', data, socket)) {
          return ack_cb('_middle error');
        }
        conditions = data.conditions || {};
        return _this.model.count(conditions, function(err, count) {
          return ack_cb(err, count);
        });
      });
    });
  };

  return API;

})();

module.exports = API;
