_ = require('lodash')
defaults = _.partialRight(_.merge, _.defaults)

class API
  constructor: (options)->
    @name_space = options.name_space
    @collection_name = options.collection_name
    @model = options.model
    @use_stream = options.use_stream || false
    @stream = undefined
    @stream_query = options.stream_query || {}
    @default_query = options.default_query || {}

    # copy default query to all query
    if @default_query.default
      for method in ['create', 'update', 'remove', 'find', 'count']
        if method of @default_query
          q = @default_query[method]
          defaults(q, @default_query.default)
        else
          @default_query[method] = @default_query.default
        

  _event: (name)=>
    return @collection_name + " " + name

  init: (io)=>

    @io = io
    @channel = @io.of('/socket_api_' + @name_space)

    if @use_stream
      conditions = {}
      if @default_query.find
        conditions = @default_query.find.conditions
      @stream = @model.find(conditions).tailable().stream()

      @stream.on 'data', (doc)=>
        @channel.emit @_event('update'), {method: 'stream', docs: [doc]}

    @channel.on 'connection', (socket)=>

      # C -----
      socket.on @_event('create'), (data, ack_cb)=>
        if @default_query.create
          doc = defaults(data.doc, @default_query.create.doc)
        else
          doc = data.doc
        @model.create doc, (err)=>
          ack_cb(err)
          if not err
            if not @use_stream
              @channel.emit @_event('update'), {method: 'create', docs: [doc]}

      # U -----
      socket.on @_event('update'), (data, ack_cb)=>
        if @default_query.update
          conditions = defaults(data.conditions || {}, @default_query.update.conditions)
          update = defaults(data.update || {}, @default_query.update.update)
          options = defaults(data.options || {}, @default_query.update.options)
        @model.update conditions, update, options, (err, numberAffected, raw)=>
          ack_cb(err, numberAffected, raw)
          if not err
            @channel.emit @_event('update'), {method: 'update', numberAffected: numberAffected, raw: raw}
      
      # D -----
      socket.on @_event('remove'), (data, ack_cb)=>
        if @default_query.remove
          conditions = defaults(data.conditions || {}, @default_query.remove.conditions)
        else
          conditions = data.conditions
        @model.remove conditions, (err)=>
          ack_cb(err)
          if not err
            @channel.emit @_event('update'), {method: 'remove', conditions: conditions}


      # R -----
      socket.on @_event('find'), (data, ack_cb)=>
        if @default_query.find
          conditions = defaults(data.conditions || {}, @default_query.find.conditions)
          fields = defaults(data.fields || {}, @default_query.find.fields)
          options = defaults(data.options || {}, @default_query.find.options)
        else
          conditions = data.conditions
          fields = data.fields
          options = data.options
        @model.find conditions, fields, options, (err, docs)=>
          ack_cb(err, docs)

      # count -----
      socket.on @_event('count'), (data, ack_cb)=>
        if @default_query.count
          conditions = defaults(data.conditions || {}, @default_query.count.conditions)
        else
          conditions = data.conditions
        @model.count conditions, (err, count)=>
          ack_cb(err, count)

module.exports = API
