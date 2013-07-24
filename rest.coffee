require('sugar')
async = require 'async'

# rest api
class API
  constructor: (options)->
    @model = options.model
    @collection_name = if options.collection_name then options.collection_name else 'results'
    @limit = options.limit || 10

    @_middlewares = []

  # middleware
  # todo: method name, before, after
  use: (middleware)=>
    @_middlewares.push(middleware)

  _parse: (req, param_name, isPost)=>
    val = undefined
    if isPost
      val = req.body[param_name]
    else
      val = req.param(param_name)
    if val
      if Object.isString(val)
        return JSON.parse(val)
      else
        return val
    return undefined

  # C
  create: (req, res) =>
    query = @_parse(req, 'query', true)
    for middleware in @_middlewares
      query = middleware(query, req, res)
    doc = query.doc || {}
    @model.create doc, (err)=>
      res.send {err: err}

  # U
  update: (req, res) =>
    query = @_parse(req, 'query', true)
    for middleware in @_middlewares
      query = middleware(query, req, res)
    conditions = query.conditions || {}
    update = query.update || undefined
    options = query.options || {}
    @model.update conditions, update, options, (err, numberAffected, raw)=>
      res.send {err: err, numberAffected: numberAffected, raw: raw}

  # D
  remove: (req, res) =>
    query = @_parse(req, 'query', true)
    for middleware in @_middlewares
      query = middleware(query, req, res)
    conditions = query.conditions || {}
    @model.remove conditions, (err)=>
      res.send {err: err}

  # R
  findOne: (req, res) =>
    query = @_parse(req, 'query')
    for middleware in @_middlewares
      query = middleware(query, req, res)
    conditions = query.conditions || {}
    fields = query.fields || {}
    options = query.options || {}
    @model.findOne conditions, fields, options, (err, doc)=>
      res.send {err: err, doc: doc}

  # R
  find: (req, res) =>
    query = @_parse(req, 'query')
    for middleware in @_middlewares
      query = middleware(query, req, res)
    conditions = query.conditions || {}
    fields = query.fields || {}
    options = query.options || {}
    page = query.page || 0
    limit = @limit
    options['limit'] = @limit
    options['skip'] = page * @limit

    async.parallel [
      (cb)=>
        @model.count conditions, cb
      (cb)=>
        @model.find conditions, fields, options, cb
    ], (err, results)=>
      cnt = results[0]
      docs = results[1]
      options = {}
      options.count = cnt
      options.page = page
      options.limit = limit
      options.page_length = Math.ceil(cnt / limit)
      res.send {err: err, docs: docs, options: options}

  # R
  count: (req, res) =>
    query = @_parse(req, 'query')
    for middleware in @_middlewares
      query = middleware(query, req, res)
    conditions = query.conditions || {}
    @model.count conditions, (err, count)=>
      res.send {err: err, count: count}

  # R
  aggregate: (req, res) =>
    query = @_parse(req, 'query')
    for middleware in @_middlewares
      query = middleware(query, req, res)
    array = query.array || []
    options = query.options || {}
    @model.aggregate array, options, (err, docs)=>
      res.send {err: err, docs: docs}

  # create
  init: (app, options)=>
    header = if (options and options.header) then options.header else '/api/'
    header = header + @collection_name
    enables = if (options and options.enables) then options.enables else undefined
    check = (name)=>
      return (not enables) or ( (name of enables) and enables[name])
    if check("create")
      app.post header + '/create', @create
    if check("update")
      app.put header + '/update', @update
    if check("remove")
      app.delete header + '/remove', @remove
    if check("findOne")
      app.get header + '/findOne', @findOne
    if check("find")
      app.get header + '/find', @find
    if check("count")
      app.get header + '/count', @count
    if check("aggregate")
      app.get header + '/aggregate', @aggregate

module.exports = API
