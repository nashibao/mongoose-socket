_ = require('lodash')
_defaults = _.partialRight(_.merge, _.defaults)

async = require 'async'

copy = (d)=>
  temp = {}
  for k of d
    if _.isFunction(d[k])
      temp[k] = d[k]
    else if _.isObject(d[k])
      temp[k] = copy(d[k])
    else
      temp[k] = d[k]
  return temp

defaults = (d1, d2)=>
  if not d1?
    return d2
  _d1 = copy(d1)
  return _defaults(_d1, d2)

class API
  constructor: (options)->
    @name_space = options.name_space
    @collection_name = options.collection_name
    @model = options.model
    @use_stream = options.use_stream || false
    @stream = undefined
    @limit = options.limit || 10
    @stream_query = options.stream_query || {}
    @default_query = options.default_query || {}
    @overwrite_query = options.overwrite_query || {}

    @middlewares = options.middlewares || {}

    # copy default query to all query
    if @default_query.default?
      for method in ['create', 'update', 'remove', 'find', 'count']
        if method of @default_query
          q = @default_query[method]
          _defaults(q, @default_query.default)
        else
          q = @default_query[method] = @default_query.default
    if @overwrite_query.default?
      for method in ['create', 'update', 'remove', 'find', 'count']
        if method of @overwrite_query
          q = @overwrite_query[method]
          _defaults(q, @overwrite_query.default)
        else
          @overwrite_query[method] = @overwrite_query.default
        

  _event: (name)=>
    return @collection_name + " " + name

  update: (method, docs)=>
    @channel.emit @_event('update'), {method: method, docs: docs}


  check_middleware: (method, data)=>
    if @middlewares['default']?
      for middleware in @middlewares['default']
        data = middleware(data)
    if @middlewares[method]?
      for middleware in @middlewares[method]
        data = middleware(data)
    return data

  init: (io)=>

    @io = io
    @channel = @io.of('/socket_api_' + @name_space)

    if @use_stream
      conditions = {}
      if @default_query.find?
        conditions = @default_query.find.conditions
      if @overwrite_query.find?
        conditions = defaults(@overwrite_query.find.conditions, conditions)
      @stream = @model.find(conditions).tailable().stream()

      @stream.on 'data', (doc)=>
        @update('stream', [doc])

    @channel.on 'connection', (socket)=>

      # C -----
      socket.on @_event('create'), (data, ack_cb)=>
        data = @check_middleware('create', data)
        if @default_query.create?
          doc = defaults(data.doc, @default_query.create.doc)
        else
          doc = data.doc
        if @overwrite_query.create?
          doc = defaults(@overwrite_query.create.doc, doc)
        @model.create doc, (err)=>
          ack_cb(err)
          if not err
            if not @use_stream
              @channel.emit @_event('update'), {method: 'create', docs: [doc]}

      # U -----
      socket.on @_event('update'), (data, ack_cb)=>
        data = @check_middleware('update', data)
        if @default_query.update?
          conditions = defaults(data.conditions, @default_query.update.conditions)
          update = defaults(data.update, @default_query.update.update)
          options = defaults(data.options, @default_query.update.options)
        if @overwrite_query.update?
          conditions = defaults(@overwrite_query.update.conditions, conditions)
          update = defaults(@overwrite_query.update.update, update)
          options = defaults(@overwrite_query.update.options, options)
        @model.update conditions, update, options, (err, numberAffected, raw)=>
          ack_cb(err, numberAffected, raw)
          if not err
            @channel.emit @_event('update'), {method: 'update', numberAffected: numberAffected, raw: raw}
      
      # D -----
      socket.on @_event('remove'), (data, ack_cb)=>
        data = @check_middleware('remove', data)
        if @default_query.remove?
          conditions = defaults(data.conditions, @default_query.remove.conditions)
        else
          conditions = data.conditions
        if @overwrite_query.remove?
          conditions = defaults(@overwrite_query.remove.conditions, conditions)
        @model.remove conditions, (err)=>
          ack_cb(err)
          if not err
            @channel.emit @_event('update'), {method: 'remove', conditions: conditions}


      # R -----
      socket.on @_event('find'), (data, ack_cb)=>
        data = @check_middleware('find', data)
        if @default_query.find?
          conditions = defaults(data.conditions, @default_query.find.conditions)
          fields = defaults(data.fields, @default_query.find.fields)
          options = defaults(data.options, @default_query.find.options)
        else
          conditions = data.conditions
          fields = data.fields
          options = data.options
        page = data.page || 0
        limit = @limit
        options = options || {}
        options['limit'] = @limit
        options['skip'] = page * @limit
        if @overwrite_query.find?
          conditions = defaults(@overwrite_query.find.conditions, conditions)
          fields = defaults(@overwrite_query.find.fields, fields)
          options = defaults(@overwrite_query.find.options, options)
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
          ack_cb(err, docs, options)

        
        

      # aggregate -----
      socket.on @_event('aggregate'), (data, ack_cb)=>
        data = @check_middleware('aggregate', data)
        if @default_query.aggregate?
          array = defaults(data.array, @default_query.aggregate.array)
          options = defaults(data.options, @default_query.aggregate.options)
        else
          array = data.array
          options = data.options
        if @overwrite_query.aggregate?
          array = defaults(@overwrite_query.aggregate.array, array)
          options = defaults(@overwrite_query.aggregate.options, options)
        @model.aggregate array, options, (err, docs)=>
          ack_cb(err, docs)

      # count -----
      socket.on @_event('count'), (data, ack_cb)=>
        data = @check_middleware('count', data)
        if @default_query.count?
          conditions = defaults(data.conditions, @default_query.count.conditions)
        else
          conditions = data.conditions
        if @overwrite_query.count?
          conditions = defaults(@overwrite_query.count.conditions, conditions)
        @model.count conditions, (err, count)=>
          ack_cb(err, count)

module.exports = API
