
class API
  constructor: (options)->
    @name_space = options.name_space
    @collection_name = options.collection_name
    @model = options.model
    @use_stream = options.use_stream || false
    @stream = undefined
    @stream_query = options.stream_query || {}

  _event: (name)=>
    return @collection_name + " " + name

  init: (io)=>

    @io = io
    @channel = @io.of('/socket_api_' + @name_space)

    if @use_stream
      @stream = @model.find(@stream_query).tailable().stream()

      @stream.on 'data', (doc)=>
        @channel.emit @_event('update'), {method: 'stream', docs: [doc]}

    @channel.on 'connection', (socket)=>

      # C -----
      socket.on @_event('create'), (data, ack_cb)=>
        doc = data.doc
        @model.create doc, (err)=>
          ack_cb(err)
          if not err
            if not @use_stream
              @channel.emit @_event('update'), {method: 'create', docs: [doc]}

      # U -----
      socket.on @_event('update'), (data, ack_cb)=>
        conditions = data.conditions
        update = data.update
        options = data.options
        @model.update conditions, update, options, (err, numberAffected, raw)=>
          ack_cb(err, numberAffected, raw)
          if not err
            @channel.emit @_event('update'), {method: 'update', numberAffected: numberAffected, raw: raw}
      
      # D -----
      socket.on @_event('remove'), (data, ack_cb)=>
        conditions = data.conditions
        @model.remove conditions, (err)=>
          ack_cb(err)
          if not err
            @channel.emit @_event('update'), {method: 'remove', conditions: conditions}


      # R -----
      socket.on @_event('find'), (data, ack_cb)=>
        conditions = data.conditions
        fields = data.fileds
        options = data.options
        @model.find conditions, fields, options, (err, docs)=>
          ack_cb(err, docs)

      # count -----
      socket.on @_event('count'), (data, ack_cb)=>
        conditions = data.conditions
        @model.count conditions, (err, count)=>
          ack_cb(err, count)

module.exports = API
