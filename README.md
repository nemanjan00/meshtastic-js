# meshtastic-js

JS lib for talking to Meshtastic node from Browser or Node.JS

## Table of contents

<!-- vim-markdown-toc GFM -->

* [Usage](#usage)
* [Installation](#installation)
	* [NPM](#npm)
	* [Yarn](#yarn)
* [Author](#author)

<!-- vim-markdown-toc -->

## Usage

```javascript
const { interfaceFactory, commandsFactory } = require("meshtastic-js");

const interface = interfaceFactory("/dev/ttyUSB0");
const commands = commandsFactory(interface);

commands.getNodeDB().then(data => {
	console.log(data);
});
```

## Installation

### NPM

```
npm install meshtastic-js --save
```

### Yarn

```
yarn add meshtastic-js
```

## Author

* [nemanjan00](https://github.com/nemanjan00)
