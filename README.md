## Getting Started

* Download [Narwhal](http://github.com/tlrobinson/narwhal/tree/master).
* Add the Narwhal bin directory to your PATH `export PATH=$PATH:/path/to/narwhal/bin`
* Install Jack `tusk install jack`
* Download [narwhal-jsontemplate](http://github.com/nrstott/narwhal-jsontemplate/tree/master)
* Create a symbolic link in your narwhal packages directory to jsontemplate.  `ln -s /path/to/jsontemplate /path/to/narwhal/packages`

## Hello World in Bogart

>var bogart = require("bogart");
>
>GET("/:name", function() {
>  this.response.write("Hello " + this.params["name"]);
>  return this.response.finish();
>});  
>
>exports.app = bogart.app;

Start your app: `jackup -r app.js`

Visit it in a web browser at [http://localhost:8080](http://localhost:8080).

## Inspirations

* [Sinatra](http://www.sinatrarb.com/)
* [Rails](http://rubyonrails.org/)

## License

Copyright (c) 2009 Nathan Stott <[nathan.whiteboard-it.com](http://nathan.whiteboard-it.com/)\>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.