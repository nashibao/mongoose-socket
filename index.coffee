_ = require('lodash')
_defaults = _.partialRight(_.merge, _.defaults)

async = require 'async'

class API
  constructor: (options)->
    @name_space = options.name_space
    @collection_name = options.collection_name
    @model = options.model
    @use_stream = options.use_stream || false
    @stream = undefined
    @limit = options.limit || 10
    @default = options.default || {}
    @middlewares = options.middlewares || {}

  _event: (name)=>
    return @collection_name + " " + name

  update: (method, docs)=>
    @channel.emit @_event('update'), {method: method, docs: docs}


  check_middleware: (method, data)=>
    if @middlewares['default']?
      if _.isFunction(@middlewares['default'])
        data = @middlewares['default'](data)
      else
        for middleware in @middlewares['default']
          data = middleware(data)
    if @middlewares[method]?
      if _.isFunction(@middlewares[method])
        data = @middlewares[method](data)
      else
        for middleware in @middlewares[method]
          data = middleware(data)
    return data

  init: (io)=>

    @io = io
    @channel = @io.of('/socket_api_' + @name_space)

    if @use_stream
      conditions = @default.conditions || {}
      @stream = @model.find(conditions).tailable().stream()

      @stream.on 'data', (doc)=>
        @update('stream', [doc])

    @channel.on 'connection', (socket)=>

      # C -----
      socket.on @_event('create'), (data, ack_cb)=>
        data = @check_middleware('create', data)
        doc = data.doc || @default.doc || {}
        @model.create doc, (err)=>
          ack_cb(err)
          if not err
            if not @use_stream
              @channel.emit @_event('update'), {method: 'create', docs: [doc]}

      # U -----
      socket.on @_event('update'), (data, ack_cb)=>
        data = @check_middleware('update', data)
        conditions = data.conditions || @default.conditions || {}
        update = data.update || @default.update || {}
        options = data.options || @default.options || {}
        @model.update conditions, update, options, (err, numberAffected, raw)=>
          ack_cb(err, numberAffected, raw)
          if not err
            @channel.emit @_event('update'), {method: 'update', numberAffected: numberAffected, raw: raw}
      
      # D -----
      socket.on @_event('remove'), (data, ack_cb)=>
        data = @check_middleware('remove', data)
        conditions = data.conditions || @default.conditions || {}
        @model.remove conditions, (err)=>
          ack_cb(err)
          if not err
            @channel.emit @_event('update'), {method: 'remove', conditions: conditions}


      # R -----
      socket.on @_event('find'), (data, ack_cb)=>
        data = @check_middleware('find', data)
        conditions = data.conditions || @default.conditions || {}
        fields = data.fields || @default.fields || {}
        options = data.options || @default.options || {}
        page = data.page || 0
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
          ack_cb(err, docs, options)

      # aggregate -----
      socket.on @_event('aggregate'), (data, ack_cb)=>
        data = @check_middleware('aggregate', data)
        array = data.array || @default.array || {}
        options = data.options || @default.options || {}
        @model.aggregate array, options, (err, docs)=>
          ack_cb(err, docs)

      # count -----
      socket.on @_event('count'), (data, ack_cb)=>
        data = @check_middleware('count', data)
        conditions = data.conditions || @default.conditions || {}
        @model.count conditions, (err, count)=>
          ack_cb(err, count)

module.exports = API
