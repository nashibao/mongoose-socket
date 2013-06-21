
build:
	coffee --compile --bare index.coffee

clean:
	rm -fr index.js

.PHONY: clean
