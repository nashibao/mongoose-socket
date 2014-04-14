_ = require('lodash')
_defaults = _.partialRight(_.merge, _.defaults)

async = require 'async'

class API
  constructor: (options={})->
    @name_space = options.name_space || ''
    @collection_name = options.collection_name || ''
    @model = options.model || false
    @use_stream = options.use_stream || false
    @limit = options.limit || 10
    @_middlewares = options.middlewares || []
    @stream = false

    @run = {}
    for key in ['find', 'create', 'findOneAndUpdate', 'remove', 'findOne', 'count', 'find', 'aggregate']
      @run[key] = @query(key)

  query: (name)->
    q = @model['__' + name] || @model[name]
    q = q.bind(@model)
    return q

  use: (middleware)=>
    @_middlewares.push(middleware)

  _event: (name)=>
    return @collection_name + " " + name

  update: (method, docs)=>
    @channel.emit @_event('update'), {method: method, docs: docs}

  _middle: (method, data, socket)=>
    bl = true
    for mw in @_middlewares
      bl = bl and mw(method, data, socket)
    return bl

  init: (io)=>

    @io = io
    @channel = @io.of('/socket_api_' + @name_space)

    if @use_stream
      @stream = @run['find']({}).tailable().stream()

      @stream.on 'data', (doc)=>
        @update('stream', [doc])

    @channel.on 'connection', (socket)=>

      # C -----
      socket.on @_event('create'), (data, ack_cb)=>
        if not @_middle('create', data, socket)
          return ack_cb('_middle error')
        if not (data.doc?)
          return ack_cb('no doc parameter')
        doc = data.doc
        @run['create'] doc, (err)=>
          ack_cb(err)
          if not err
            if not @use_stream
              @channel.emit @_event('update'), {method: 'create', docs: [doc]}

      # U -----
      socket.on @_event('update'), (data, ack_cb)=>
        if not @_middle('update', data, socket)
          return ack_cb('_middle error')
        conditions = data.conditions || {}
        update = data.update || {}
        options = data.options || {}
        options.new = true
        @run['findOneAndUpdate'] conditions, update, options, (err, ndoc)=>
          ack_cb(err, ndoc)
          if not err
            @channel.emit @_event('update'), {method: 'update', doc: ndoc}
      
      # D -----
      socket.on @_event('remove'), (data, ack_cb)=>
        if not @_middle('remove', data, socket)
          return ack_cb('_middle error')
        conditions = data.conditions || {}
        @run['remove'] conditions, (err)=>
          ack_cb(err)
          if not err
            @channel.emit @_event('update'), {method: 'remove', conditions: conditions}

      # findOne -----
      socket.on @_event('findOne'), (data, ack_cb)=>
        if not @_middle('findOne', data, socket)
          return ack_cb('_middle error')
        conditions = data.conditions || {}
        fields = data.fields || {}
        options = data.options || {}
        @run['findOne'] conditions, fields, options, (err, doc)=>
          ack_cb(err, doc)


      # R -----
      socket.on @_event('find'), (data, ack_cb)=>
        if not @_middle('find', data, socket)
          return ack_cb('_middle error')
        conditions = data.conditions || {}
        fields = data.fields || {}
        options = data.options || {}
        page = data.page || 0
        limit = @limit
        options['limit'] = @limit
        options['skip'] = page * @limit
        async.parallel [
          (cb)=>
            @run['count'] conditions, cb
          (cb)=>
            @run['find'] conditions, fields, options, cb
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
        if not @_middle('aggregate', data, socket)
          return ack_cb('_middle error')
        array = data.array || {}
        options = data.options || {}
        @run['aggregate'](array).exec (err, docs)=>
          ack_cb(err, docs)

      # count -----
      socket.on @_event('count'), (data, ack_cb)=>
        if not @_middle('count', data, socket)
          return ack_cb('_middle error')
        conditions = data.conditions || {}
        @run['count'] conditions, (err, count)=>
          ack_cb(err, count)

module.exports = API
