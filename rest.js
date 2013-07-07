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
    this.remove = __bind(this.remove, this);
    this.update = __bind(this.update, this);
    this.create = __bind(this.create, this);
    this._parse = __bind(this._parse, this);
    this.model = options.model;
    this.collection_name = options.collection_name ? options.collection_name : 'results';
    this.limit = options.limit || 10;
  }

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
    var doc, query,
      _this = this;
    query = this._parse(req, 'query', true);
    doc = query.doc || {};
    return this.model.create(doc, function(err) {
      return res.send({
        err: err
      });
    });
  };

  API.prototype.update = function(req, res) {
    var conditions, options, query, update,
      _this = this;
    query = this._parse(req, 'query', true);
    conditions = query.conditions || {};
    update = query.update || void 0;
    options = query.options || {};
    return this.model.update(conditions, update, options, function(err, numberAffected, raw) {
      return res.send({
        err: err,
        numberAffected: numberAffected,
        raw: raw
      });
    });
  };

  API.prototype.remove = function(req, res) {
    var conditions, query,
      _this = this;
    query = this._parse(req, 'query', true);
    conditions = query.conditions || {};
    return this.model.remove(conditions, function(err) {
      return res.send({
        err: err
      });
    });
  };

  API.prototype.find = function(req, res) {
    var conditions, fields, limit, options, page, query,
      _this = this;
    query = this._parse(req, 'query');
    conditions = query.conditions || {};
    fields = query.fields || {};
    options = query.options || {};
    page = query.page || 0;
    limit = this.limit;
    options['limit'] = this.limit;
    options['skip'] = page * this.limit;
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
      return res.send({
        err: err,
        docs: docs,
        options: options
      });
    });
  };

  API.prototype.count = function(req, res) {
    var conditions, query,
      _this = this;
    query = this._parse(req, 'query');
    conditions = query.conditions || {};
    return this.model.count(conditions, function(err, count) {
      return res.send({
        err: err,
        count: count
      });
    });
  };

  API.prototype.aggregate = function(req, res) {
    var array, options, query,
      _this = this;
    query = this._parse(req, 'query');
    array = query.array || [];
    options = query.options || {};
    return this.model.aggregate(array, options, function(err, docs) {
      return res.send({
        err: err,
        docs: docs
      });
    });
  };

  API.prototype.init = function(app, options) {
    var check, enables, header,
      _this = this;
    header = options && options.header ? options.header : '/api/';
    header = header + this.collection_name;
    enables = options && options.enables ? options.enables : void 0;
    check = function(name) {
      return (!enables) || ((name in enables) && enables[name]);
    };
    if (check("create")) {
      app.post(header + '/create', this.create);
    }
    if (check("update")) {
      app.put(header + '/update', this.update);
    }
    if (check("remove")) {
      app["delete"](header + '/remove', this.remove);
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
