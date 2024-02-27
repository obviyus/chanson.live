# [1.2.0](https://github.com/obviyus/chanson.live/compare/v1.1.0...v1.2.0) (2024-02-27)


### Features

* **db:** configurable DB path ([a51ac88](https://github.com/obviyus/chanson.live/commit/a51ac882b38a80acaa14fe986a9648d1dbe3bde9))

# [1.1.0](https://github.com/obviyus/chanson.live/compare/v1.0.0...v1.1.0) (2024-02-27)


### Features

* **controller:** allow customizable command server host ([9c439d7](https://github.com/obviyus/chanson.live/commit/9c439d73f1daf8e75f42c64ff20d4e65be115a12))

# 1.0.0 (2024-02-27)


### Bug Fixes

* **blacklist:** map ADMINs to int ([1b7d201](https://github.com/obviyus/chanson.live/commit/1b7d201378e8655ba6d287661e0fe8c0cc7a6fd7))
* **build:** use ts-node in production ([c1bd37e](https://github.com/obviyus/chanson.live/commit/c1bd37e7a140f266711bb1fcc340cc469f2c2da9))
* **catch:** catch LookupError ([645084f](https://github.com/obviyus/chanson.live/commit/645084fc62d337fcae183672792b0d03f77d6f64))
* **client:** use `remix-utils` ([007e32b](https://github.com/obviyus/chanson.live/commit/007e32bf093a1be0713f582222a8f4425f55c37f))
* **client:** use ClientOnly ([d164363](https://github.com/obviyus/chanson.live/commit/d16436365c91eaafca904361bc82acdc798fbb2e))
* **job_queue:** speed up player ([63d1ac8](https://github.com/obviyus/chanson.live/commit/63d1ac83e856ad5fb03d39b0fa101d6db9d11f32))
* **mediasoup:** pick announce IPs from ENV ([b1f8609](https://github.com/obviyus/chanson.live/commit/b1f8609add419de314b68939033b79d21abbaea3))
* **name:** rename to chanson.live ([b4c1900](https://github.com/obviyus/chanson.live/commit/b4c19004673043df0df1a428a5c9ccd151f9d135))
* **name:** use `name` over `display_name` ([437907e](https://github.com/obviyus/chanson.live/commit/437907e96c1d1526e81ecd60a8e41d488daa8994))
* **player:** catch type error ([90e0d39](https://github.com/obviyus/chanson.live/commit/90e0d39e5bcdd582f5aad0b3361c16f9b630070b))
* **player:** handle exceptions ([13f1c4f](https://github.com/obviyus/chanson.live/commit/13f1c4f3e986d5afd916497754fb37411807eb9b))
* **playlist:** fix logic for playlist ([d660573](https://github.com/obviyus/chanson.live/commit/d660573710dc05ae6630bc5b946049853efaef05))
* **queue:** fix queuing logic ([cf0a382](https://github.com/obviyus/chanson.live/commit/cf0a382fe3342f8e5ddeae6421a1f95acfa09ed6))
* **queue:** improve queue update logic ([f281376](https://github.com/obviyus/chanson.live/commit/f2813765d0050684c2a659dc874c902f184b32a0))
* **queue:** re-add missing insert func ([7e17489](https://github.com/obviyus/chanson.live/commit/7e174899c43aaa10e9270a9d7fee737b3067f2ce))
* **queue:** remove excessive queue update calls ([8b5a745](https://github.com/obviyus/chanson.live/commit/8b5a745999d8424d6acb4436cd388d37f545752f))
* **release:** rename branch to main ([1c59a68](https://github.com/obviyus/chanson.live/commit/1c59a68bcdb0ca0f79b1efde770b645132a5789c))
* **router:** fix client naming for routing ([3df676e](https://github.com/obviyus/chanson.live/commit/3df676e345814772f3cd8fe07f54bb043e9794c3))
* **search:** check for message object ([a9d3838](https://github.com/obviyus/chanson.live/commit/a9d38383fb679dddd1bb98eb3d26fe236fee131e))
* **search:** handle missing message object ([09a12e6](https://github.com/obviyus/chanson.live/commit/09a12e640df8bfbd154a02676815349e62e4c421))
* **socket:** broadcast clientCount ([5278a15](https://github.com/obviyus/chanson.live/commit/5278a15fe1a09d02e2fd2df3983b903425d3f8c8))
* **socket:** don't broadcast when new client joins ([776c067](https://github.com/obviyus/chanson.live/commit/776c067c56b39a07762eb35ca9b16907946cbac6))
* **socket:** send metadata to new clients ([0bdf88d](https://github.com/obviyus/chanson.live/commit/0bdf88d6cdfc9fc9dd5979aba8bb258a4b55ee1b))
* **telegram:** fix broken indent ([9d5d415](https://github.com/obviyus/chanson.live/commit/9d5d415d19dd1dda1e4e48212f09269e8fb5532c))
* **tsc:** silence type errors ([5a52211](https://github.com/obviyus/chanson.live/commit/5a52211ad8ce75af5c5d8ae2da24aeb4c2584811))
* **ui:** include attribution ([34dc452](https://github.com/obviyus/chanson.live/commit/34dc452b155fccfbd1c3c46b2c650f9287cef73b))
* **yt-dlp:** use entry title ([f1bd780](https://github.com/obviyus/chanson.live/commit/f1bd780354275d393e64938bf71dc2e4352f9b71))
* **yt:** save ID as filename ([67ec17e](https://github.com/obviyus/chanson.live/commit/67ec17e1361ad28788cbae9b3f14d28269ec5b72))


### Features

* **blacklist:** command to blacklist songs ([037d092](https://github.com/obviyus/chanson.live/commit/037d0929265373c04116b23784642076c62a4724))
* **history:** store history of songs played ([cf59be7](https://github.com/obviyus/chanson.live/commit/cf59be7db1b794c685772d988a6a4017f60aa7e0))
* **meta:** create meta tags ([aac726d](https://github.com/obviyus/chanson.live/commit/aac726d62dacadc73580340065b10523ee12eb23))
* **metadata:** show song metadata on site ([bbd6172](https://github.com/obviyus/chanson.live/commit/bbd6172db615fe6f605bb6291c21875b3fb6a663))
* **meta:** include metadata in site ([7eae5c1](https://github.com/obviyus/chanson.live/commit/7eae5c1a5002ae29eb8eb30725d780d58496f0b2))
* **player:** deliver queue of songs instead of just metadata ([2eec60b](https://github.com/obviyus/chanson.live/commit/2eec60b5eb6347f8c18b0643f36735ea41328363))
* **playlist:** build playlist support ([0f3f3fd](https://github.com/obviyus/chanson.live/commit/0f3f3fd805aa9761214adcefbeed23121d0aa2f2))
* **queue:** create queue component ([ceab3df](https://github.com/obviyus/chanson.live/commit/ceab3df166d4900a0594fc38d2ce04e5bf396fc7))
* **queue:** don't play any of the most recently played 100 songs ([f7fb25c](https://github.com/obviyus/chanson.live/commit/f7fb25cbcf477a0452124007ef46412111ecd882))
* **skip, playlist:** add new commands ([b1036ba](https://github.com/obviyus/chanson.live/commit/b1036ba566c4ddef248bbfcf4bdd7f6bbc5eeb10))
* **socket:** use enums for socket messages ([b164db0](https://github.com/obviyus/chanson.live/commit/b164db0484a1db919582f777f668745a3c701e5b))
* **spotdl:** search music on Spotify ([69d9e7b](https://github.com/obviyus/chanson.live/commit/69d9e7b8de0baf4165ac9b49529d069ceadb51f7))
* **telegram:** use PTB v20 ([2eb3e58](https://github.com/obviyus/chanson.live/commit/2eb3e58fa3ced78795f2c5f3d90daead1fcb0788))
* **v2:** simplify and improve Remix logic ([bdd16cb](https://github.com/obviyus/chanson.live/commit/bdd16cbee8952af90387da7c8b83bdfde4058e6e))
* **v2:** upgrade remix entrypoint ([20c6328](https://github.com/obviyus/chanson.live/commit/20c632863f56210c4ba807fbe69873fb5d5a98dd))
* **volume:** manage state of volume ([92ad506](https://github.com/obviyus/chanson.live/commit/92ad5067dc64a99cdf9844a118424b05b1298b7e))
