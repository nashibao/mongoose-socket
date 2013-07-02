require('sugar')

# rest api
class API
  constructor: (options)->
    @model = options.model
    @collection_name = if options.collection_name then options.collection_name else 'results'

  _parse: (req, param_name)=>
    if req.param(param_name)
      if Object.isString(req.param(param_name))
        return JSON.parse(req.param(param_name))
      else
        return req.param(param_name)
    return undefined

  # C
  create: (req, res) =>
    doc = @_parse(req, 'doc')
    @model.create doc, (err)=>
      res.send {err: err}

  # U
  update: (req, res) =>
    conditions = @_parse(req, 'conditions')
    update = @_parse(req, 'update')
    options = @_parse(req, 'options')
    @model.update conditions, update, options, (err, numberAffected, raw)=>
      res.send {err: err, numberAffected: numberAffected, raw: raw}

  # D
  remove: (req, res) =>
    conditions = @_parse(req, 'conditions')
    @model.remove conditions, (err)=>
      res.send {err: err}

  # R
  find: (req, res) =>
    conditions = @_parse(req, 'conditions')
    fields = @_parse(req, 'fields')
    options = @_parse(req, 'options')
    @model.find conditions, fields, options, (err, docs)=>
      res.send {err: err, docs: docs}

  # R
  count: (req, res) =>
    conditions = @_parse(req, 'conditions')
    @model.count conditions, (err, count)=>
      res.send {err: err, count: count}

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
    if check("find")
      app.get header + '/find', @find
    if check("count")
      app.get header + '/count', @count

module.exports = API