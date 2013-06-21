
class API
  constructor: (name_space, collection_name, model, io)->
    @name_space = name_space
    @collection_name = collection_name
    @model = model
    @io = io
    @channel = @io.of('/socket_api_' + @name_space)

  event: (name)=>
    return @collection_name + " " + name

  create: ()=>

    @channel.on 'connection', (socket)=>

      # C -----
      socket.on @event('create'), (data, ack_cb)=>
        doc = data.doc
        @model.create doc, (err)=>
          ack_cb(err)
          if not err
            @channel.emit @event('update'), {method: 'create', docs: [doc]}

      # U -----
      socket.on @event('update'), (data, ack_cb)=>
        conditions = data.conditions
        update = data.update
        options = data.options
        @model.update conditions, update, options, (err, numberAffected, raw)=>
          ack_cb(err, numberAffected, raw)
          if not err
            @channel.emit @event('update'), {method: 'update', numberAffected: numberAffected, raw: raw}
      
      # D -----
      socket.on @event('remove'), (data, ack_cb)=>
        conditions = data.conditions
        @model.remove conditions, (err)=>
          ack_cb(err)
          if not err
            @channel.emit @event('update'), {method: 'remove', conditions: conditions}


      # R -----
      socket.on @event('find'), (data, ack_cb)=>
        conditions = data.conditions
        fields = data.fileds
        options = data.options
        @model.find conditions, fields, options, (err, docs)=>
          ack_cb(err, docs)

      # count -----
      socket.on @event('count'), (data, ack_cb)=>
        conditions = data.conditions
        @model.count conditions, (err, count)=>
          ack_cb(err, count)

module.exports = API
