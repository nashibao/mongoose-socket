var API, async,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

require('sugar');

async = require('async');

API = (function() {
  function API(options) {
    this.init = __bind(this.init, this);
    this.aggregate = __bind(this.aggregate, this);
    this.count = __bind(this.count, this);
    this.find = __bind(this.find, this);
    this.findOne = __bind(this.findOne, this);
    this.remove = __bind(this.remove, this);
    this.update = __bind(this.update, this);
    this.create = __bind(this.create, this);
    this._parse = __bind(this._parse, this);
    this.use = __bind(this.use, this);
    this.model = options.model;
    this.name_space = options.name_space || '';
    this.collection_name = options.collection_name ? options.collection_name : 'results';
    this.limit = options.limit || 10;
    this._middlewares = [];
  }

  API.prototype.use = function(middleware) {
    return this._middlewares.push(middleware);
  };

  API.prototype._parse = function(req, param_name, isPost) {
    var val;
    val = void 0;
    if (isPost) {
      val = req.body[param_name];
    } else {
      val = req.param(param_name);
    }
    if (val) {
      if (Object.isString(val)) {
        return JSON.parse(val);
      } else {
        return val;
      }
    }
    return void 0;
  };

  API.prototype.create = function(req, res) {
    var doc, middleware, query, _i, _len, _ref;
    query = this._parse(req, 'query', true);
    _ref = this._middlewares;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      middleware = _ref[_i];
      query = middleware(query, req, res, 'create');
    }
    doc = query.doc || {};
    return this.model.create(doc, (function(_this) {
      return function(err, ndoc) {
        return res.send({
          err: err,
          doc: ndoc
        });
      };
    })(this));
  };

  API.prototype.update = function(req, res) {
    var conditions, middleware, options, query, update, _i, _len, _ref;
    query = this._parse(req, 'query', true);
    _ref = this._middlewares;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      middleware = _ref[_i];
      query = middleware(query, req, res, 'update');
    }
    conditions = query.conditions || {};
    update = query.update || void 0;
    options = query.options || {};
    return this.model.update(conditions, update, options, (function(_this) {
      return function(err, numberAffected, raw) {
        return res.send({
          err: err,
          numberAffected: numberAffected,
          raw: raw
        });
      };
    })(this));
  };

  API.prototype.remove = function(req, res) {
    var conditions, middleware, query, _i, _len, _ref;
    query = this._parse(req, 'query', true);
    _ref = this._middlewares;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      middleware = _ref[_i];
      query = middleware(query, req, res, 'remove');
    }
    conditions = query.conditions || {};
    return this.model.remove(conditions, (function(_this) {
      return function(err) {
        return res.send({
          err: err
        });
      };
    })(this));
  };

  API.prototype.findOne = function(req, res) {
    var conditions, fields, middleware, options, query, _i, _len, _ref;
    query = this._parse(req, 'query');
    _ref = this._middlewares;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      middleware = _ref[_i];
      query = middleware(query, req, res, 'findOne');
    }
    conditions = query.conditions || {};
    fields = query.fields || {};
    options = query.options || {};
    return this.model.findOne(conditions, fields, options, (function(_this) {
      return function(err, doc) {
        return res.send({
          err: err,
          doc: doc
        });
      };
    })(this));
  };

  API.prototype.find = function(req, res) {
    var conditions, fields, limit, middleware, options, page, query, _i, _len, _ref;
    query = this._parse(req, 'query');
    _ref = this._middlewares;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      middleware = _ref[_i];
      query = middleware(query, req, res, 'find');
    }
    conditions = query.conditions || {};
    fields = query.fields || {};
    options = query.options || {};
    page = query.page || 0;
    limit = this.limit;
    options['limit'] = this.limit;
    options['skip'] = page * this.limit;
    return async.parallel([
      (function(_this) {
        return function(cb) {
          return _this.model.count(conditions, cb);
        };
      })(this), (function(_this) {
        return function(cb) {
          return _this.model.find(conditions, fields, options, cb);
        };
      })(this)
    ], (function(_this) {
      return function(err, results) {
        var cnt, docs;
        cnt = results[0];
        docs = results[1];
        options = {};
        options.count = cnt;
        options.page = page;
        options.limit = limit;
        options.page_length = Math.ceil(cnt / limit);
        return res.send({
          err: err,
          docs: docs,
          options: options
        });
      };
    })(this));
  };

  API.prototype.count = function(req, res) {
    var conditions, middleware, query, _i, _len, _ref;
    query = this._parse(req, 'query');
    _ref = this._middlewares;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      middleware = _ref[_i];
      query = middleware(query, req, res, 'count');
    }
    conditions = query.conditions || {};
    return this.model.count(conditions, (function(_this) {
      return function(err, count) {
        return res.send({
          err: err,
          count: count
        });
      };
    })(this));
  };

  API.prototype.aggregate = function(req, res) {
    var array, middleware, options, query, _i, _len, _ref;
    query = this._parse(req, 'query');
    _ref = this._middlewares;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      middleware = _ref[_i];
      query = middleware(query, req, res, 'aggregate');
    }
    array = query.array || [];
    options = query.options || {};
    return this.model.aggregate(array, options, (function(_this) {
      return function(err, docs) {
        return res.send({
          err: err,
          docs: docs
        });
      };
    })(this));
  };

  API.prototype.init = function(app, options) {
    var check, enables, header;
    header = options && options.header ? options.header : '/api/';
    header = header + this.collection_name;
    if (this.name_space) {
      header += '/' + this.name_space;
    }
    enables = options && options.enables ? options.enables : void 0;
    check = (function(_this) {
      return function(name) {
        return (!enables) || ((name in enables) && enables[name]);
      };
    })(this);
    if (check("create")) {
      app.post(header + '/create', this.create);
    }
    if (check("update")) {
      app.put(header + '/update', this.update);
    }
    if (check("remove")) {
      app["delete"](header + '/remove', this.remove);
    }
    if (check("findOne")) {
      app.get(header + '/findOne', this.findOne);
    }
    if (check("find")) {
      app.get(header + '/find', this.find);
    }
    if (check("count")) {
      app.get(header + '/count', this.count);
    }
    if (check("aggregate")) {
      return app.get(header + '/aggregate', this.aggregate);
    }
  };

  return API;

})();

module.exports = API;
