# 超絶シンプルなストレージエンジン
# getとsetしかない

class Storage
  constructor: (options={})->
    @name_space = options.name_space || ''
    @handshake_parameter_name = options.handshake_parameter_name || '_session'

    # get handler
    @get = options.get || (socket, data, cb)->
      cb(null, socket.handshake[@handshake_parameter_name])

    # set handler
    @set = options.set || (socket, data, cb)->
      # 単純な上書き
      socket.handshake[@handshake_parameter_name] = data
      cb(null)

  _event: (name)=>
    return name

  init: (io)=>

    @io = io
    @channel = @io.of('/socket_api_storage_' + @name_space)

    @channel.on 'connection', (socket)=>
      # get
      socket.on @_event('get'), (data, ack_cb)=>
        @get socket, data, (err, doc)=>
          ack_cb(err, doc)
      # update
      socket.on @_event('set'), (data, ack_cb)=>
        @set socket, data, (err)->
          ack_cb(err)

module.exports = Storage
