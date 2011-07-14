if (typeof(topicbot) == "undefined") {
	topicbot = {
		name: "topicbot",
		owner:"@potatono",
		reloadUrl: "http://www2.justinday.com/topicbot/topicbot.js",
		turntable: null,
		room: null,
		roomManager: null,
		topViewController: null,
		sendMessageName: null,
		firstEvent: false,
		topic: null,
		suggestedTopic: null,
		started: false,
		songsPlayed: {},
		maxSongs: 3,
		language: 'en',
		freeBonus: null,
		defaultTheme: 'Free Play',
		botFunctions: true,
		botHello: true,
		botGreeting: true,
		botStage: true,
		botReminder: false,
		autoplayStatus: false,
		autoqueueMax: 0,
		autoqueueRunning: null,
		autoqueueStatus: null,
		similarRunning: false
	};
}

topicbot.version = "1.548";

topicbot.start = function() {
	console.log("topicbot version " + this.version + " starting..");
	this.started = true;
	var self = this;
	for(var i in window) {
		if(window[i] != null && typeof(window[i]) == 'object' && typeof(window[i].become_dj) == 'object') topicbot.roomManager  = window[i];
	}
	
	for(var i in turntable) {
		if (typeof(turntable[i]) == "function") {
			var match = i.match(/\w*[A-Z]\w*[A-Z]\w*/);
			if (match && i.length < 9 && i != 'seedPRNG') topicbot.sendMessageName = i;
		}
		else if (typeof(turntable[i]) == "object") {
			if(turntable[i] != null && typeof(turntable[i]) == 'object' && typeof(turntable[i].becomeDj) == 'function')  topicbot.topViewController = i;
		}
	}
	var timer = setInterval(function() {
		console.log("looking for turntable..");

		if (typeof(turntable[topicbot.topViewController]) != "undefined" && turntable[topicbot.topViewController] != null) {
			clearInterval(timer);
			
			setTimeout(function() {
				self.init();
			}, 3000);
		}
	},500);
};

topicbot.init = function() {
	console.log("init");
	
	var self = this;
	this.turntable = turntable;
	this.room = turntable[this.topViewController];

	this.turntable.addEventListener("message", function(msg) { self.onMessage(msg); });

	var f = this.room.appendChatMessage;		
	this.room.appendChatMessage = function(c,b,h) {
		f(c,b,h);
		self.onSpeak(b,h);
	};
	
	this.storage.restore();
	
	this.firstEventTimer = setInterval(function() {
		console.log("Checking to see if we're alive.");
		
		if (!self.firstEvent) {
			console.log("No events heard yet.  Let's reload.");
			self.room.reconnectListener();
		}
		else {
			console.log("Looking good.")
			clearInterval(self.firstEventTimer);
			self.firstEventTimer = null;
		}
	}, 15000);
	
	this.ui.init();
	if(this.defaultTheme && !this.topic) this.topic = this.defaultTheme;
};

topicbot.refreshRoom = function() {
	console.log("Refreshing room.");
	this.room.loadRoomState();
}

topicbot.onMessage = function(msg) {
	if (!this.firstEvent) {
		this.firstEvent = true;
		if (this.botHello) this.say(this.translations.botHello);
	}
	
	if (msg.command) {
		console.log(msg.command);
		
		if (msg.command == "registered") {
			if (this.room.djIds.length < 3) {
				if (this.room.djIds.length == 0) {
					this.topic = this.defaultTheme ? this.defaultTheme : null;
				}
				if (this.topic) {
					if (this.botFunctions && this.botGreeting) this.say(this.translations.hey + " " + msg.user[0].name + "!  " + this.translations.jumpIn + " " + this.topic + ".");
				}
				else {
					if (this.botFunctions && this.botGreeting) this.say(this.translations.hey + " " + msg.user[0].name + " " + this.translations.jumpInNoTheme);
				}
			}
			else if (this.topic) {
				if (this.botFunctions && this.botGreeting) this.say(this.translations.welcome + " " + msg.user[0].name + ".  " +this.translations.themeCurrent + " " + this.topic + ".");
			}
			else {
				if (this.botFunctions && this.botGreeting) this.say(this.translations.welcome + " " + msg.user[0].name + ". " +this.translations.themeSuggest);
			}
			
			this.autoplay.init();
		}
		else if (msg.command == "add_dj") {
			this.hiDj(msg.user[0]);
			this.autoplay.init();
		}
		else if (msg.command == "newsong") {
			turntablePlayer.stop();
			
			this.incrementSongsPlayed();
			this.clearBonus();
			
			if (this.botFunctions) this.clearOffTheme();
			
			this.storage.backup();
			this.ui.refresh();
			this.autoplay.init();

			// Don't freeward if song was short or skipped.
			if (this.freewardTimer) {
				clearTimeout(this.freewardTimer);
				this.freewardTimer = null;
			}

			// If there's nobody in the room, free rewards for songs with no love
			if (this.room.djIds.length < 3) {
				var self = this;
				console.log("Going to give some free love on this one.");
				this.freewardTimer = setTimeout(function() { console.log("Giving out love."); self.upVote(); }, 30000);
			}
			
			if (this.freeBonus) {
				setTimeout("topicbot.upVote();", 75000);
			}
		}
		else if (msg.command == "rem_dj" || msg.command == "deregistered") {
			this.byeDj(msg.user[0]);
			this.autoplay.init();
		}
		else if (msg.command == "update_votes") {
			// Song got love or was hated.  No reward.
			if (this.freewardTimer) {
				console.log("Canceling freeward.");
				clearTimeout(this.freewardTimer);
				this.freewardTimer = null;
			}
		}
		else if (msg.command == "search_complete") { // NEW
			var self = this;
			
			if (this.autoqueueStatus && this.autoqueueRunning) {
				setTimeout(function() {
					console.log("similar results: " + parseInt($(".songlist .addSong").length));
					if ($(".songlist .addSong").length) {
						self.autoqueue.queue();
					}
					else if (self.autoqueueMax < 4) {
						self.autoqueue.search();
						self.autoqueueMax++;
					}
					else {
						self.autoqueueMax = 0;
						console.log("giving up the search.");
					}
				}, 500);
			}
		}
		else if (msg.command == "search_failed") { // NEW
			if (this.autoqueueStatus) this.autoqueue.search();
		}	
	}
};

topicbot.clearOffTheme = function() {
	this.offTheme = {};
};

topicbot.currentDjName = function() {
	var name = this.room.users[this.room.currentDj].name;
	return name;
};

topicbot.incrementOffTheme = function(name) {
	this.offTheme[name] = 1;
	var votes = this.keyCount(this.offTheme);
	var required = Math.floor((this.userCount()-1)/2);

	if (required > 3) {
		required = 3;
	}

	if (votes >= required) {
		this.downVote();
		this.say(this.translations.hey + " " + this.currentDjName() + "! " + this.translations.themeOffBot + " " + this.topic);
	}
	else if (votes == 1) {
		this.say(name + " " + this.translations.themeOffUser);
	}
}

topicbot.clearBonus = function() {
	this.bonus = {};
}

topicbot.incrementBonus = function(name) {
	if (!this.bonus) { this.bonus = {}; }

	this.bonus[name] = 1;
	var votes = this.keyCount(this.bonus);
	var required = Math.floor((this.userCount()-1)/2);

	if (required > 3) {
		required = 3;
	}

	if (required < 2) {
		required = 2;
	}

	console.log("Got " + votes + " of " + required + " votes for bonus.");

	if (votes == required) {
		this.upVote();
		this.say(this.translations.niceWork + " " + this.currentDjName() + "!");
	}
	else if (votes == 1) {
		this.say(name + " " + this.translations.userSuggestBonus);
	}
}

topicbot.hiDj = function(user) {
	console.log(user.name + " started DJing");
	this.songsPlayed[user.userid] = 0;
	if (this.topic) {
		if (this.botStage) this.say(this.translations.goodLuck + " " + user.name + ".  " + this.translations.userRemeberTheme + " '" + this.topic + "'.");
	}
}

topicbot.byeDj = function(user) {
	console.log(user.name + " stopped DJing");
	var songsPlayed = this.songsPlayed[user.userid];

	//this.say("Give a round of applause to " + name + " who played " + songsPlayed + " songs this time around.");
	this.songsPlayed[user.usersid] = 0;
}

topicbot.incrementSongsPlayed = function() {
	var userid = this.room.currentDj;
	var name = this.room.users[userid].name;

	if (!this.songsPlayed) {
		this.songsPlayed = {};
	}

	if (!this.songsPlayed[userid]) {
		this.songsPlayed[userid] = 0;
	}
	
	this.songsPlayed[userid]++;
	this.storage.backup();
	var played = this.songsPlayed[userid];
	console.log(name + " has now played " + played + " songs.");
	
	if (this.botFunctions && this.decksAreFull()) {
		if (played > this.maxSongs && this.issuedWarning(name)) {
			this.say(name + " " + this.translations.roomBoot);
			this.bootUser(name);
			this.clearWarning(name);
		}
		else if (played >= this.maxSongs) {
			this.say(this.translations.roomFull + " " + name + " " + this.translations.maxSongs);
		}
	}
	else {
		this.clearWarnings();
	}
}

topicbot.warnUser = function(name,reason) {
	if (!this.warnings) { this.warnings = {}; }
	
	//this.say(reason);
	this.warnings[name] = true;
}

topicbot.issuedWarning = function(name) {
	if (!this.warnings) { this.warnings = {}; }

	return this.warnings[name];
}

topicbot.clearWarning = function(name) {
	delete this.warnings[name];
}

topicbot.clearWarnings = function() {
	this.warnings = {};
}

topicbot.decksAreFull = function() {
	return (this.room.djIds.length == this.room.maxDjs && this.userCount() > this.room.maxDjs + 1);
}

topicbot.onSpeak = function(name,text) {
	if (/^: /.test(text)) {
		this.onChat(name,text.replace(/^: /,''));
	}
};

topicbot.keyCount = function(o) {
	var count = 0;

	for (var i in o) {
		if (o.hasOwnProperty(i)) {
			count++;
		}
	}

	return count;
};

topicbot.userCount = function() {
	return this.keyCount(this.room.users);
};

topicbot.voteCount = function() {
	return this.keyCount(this.voters);
};

topicbot.setTheme = function(theme) {
	this.topic = theme;
	console.log("Theme set to '" + this.topic + "'");
};

topicbot.reload = function(lang) {
	lang = lang ? lang : topicbot.language;
	$("script[src*='" + topicbot.reloadUrl + "']").remove();
	var script = document.createElement("script");
	script.src = topicbot.reloadUrl + "?l=" + lang + "&v=" + Math.random();
	document.body.appendChild(script);
};

topicbot.suggest = function(name,topic) {
	var self = this;

	if (this.suggestedTopic) {
		this.say(this.translations.suggestedTopic + " '" + this.suggestedTopic + "'. " + this.translations.waitFinish);
	}
	else if (topic) {
		this.suggestedTopic = topic;
		this.requiredVotes = Math.floor((this.userCount()-1)/2);
		if (this.requiredVotes > 4) {
			this.requiredVotes = 4;
		}
		this.voters = {};

		this.say(name + " " + this.translations.userThemeChange + " '" + this.suggestedTopic + ".  " + this.translations.votesNeed + " " +
		this.requiredVotes + " " + this.translations.votesChange);

		setTimeout(function() { self.endSuggestedTopicElection(); }, 30000);
	}
	else {
		this.say(this.translations.suggestQuestion);
	}
};

topicbot.onChat = function(name,text) {
	console.log("<" + name + "> " + text);
	var self = this;

	var matches = text.match(/^(?:[!#])(\w+)\s*(.*)/);
	if (matches) {
		var command = matches[1];
		var args = matches[2];
		
		if (name == this.owner || name == this.name) {
			if (command == "settheme") {
				this.setTheme(args);
				this.say(this.translations.setTheme + " '" +this.topic + "'");
			}
			else if (command == "notheme") {
				this.topic = null;
				this.say(this.translations.themeNotSet);
			}
			else if (command == "reload") {
				this.reload(args);
				this.say(this.translations.botVersion + " " + this.version);
			}
			else if (command == "mute") {
				turntablePlayer.stop();
				this.say("Muted.");
			}
			else if (command == "upvote") {
				this.upVote();
				this.say(this.translations.niceWork + " " + this.currentDjName() + "!");
			}
			else if (command == "downvote") {
				this.downVote();
			}
			else if (command == "boot") {
				if (args) {
					this.bootUser(args);
				}
				else {
					this.bootCurrentDj();
				}
			}
			else if (command == "setsonglimit") {
				this.maxSongs = parseInt(args);
				this.say(this.translations.songLimit + " " + this.maxSongs);
			}
		}
		
		if (command == "theme" || command == "topic" || command == "tema") {
			if (this.botFunctions) {
				if (this.topic) {
					this.say(this.translations.themeCurrent + " " + this.topic);
				}
				else {
					this.say(this.translations.themeSuggest);
				}
			}
		}
		else if (command == "suggest") {
			if (this.botFunctions) this.suggest(name,args);
		}
		else if (command == "make") {
			this.say(this.translations.make + " " + args + " " + name + "!!");
		}
		else if (command == "songlimit" || command == "limit") {
			if (this.botFunctions) this.say(this.translations.djsCanPlay + " " + this.maxSongs + " " + this.translations.decksFull);
		}
		else if (command == "offtopic" || command == "offtheme") {
			if (this.botFunctions) this.incrementOffTheme(name);
		}
		else if (command == "bonus" || command == "awesome" || command == "love" || command == "amor") {
			this.incrementBonus(name);
		}
		else if (command == "help") { // NEW
			this.say(this.translations.help);
		}
		else if (command == "similar") { // NEW
			if (this.similarRunning) {
				this.say("easy tiger");
			}
			else {
				this.similarSongs();
			}
		}
		else if (command == "suruba" || command == "sexo" || command == "sacanagem") { // NEW
			this.say("Eu topo. Leva umas drogas?");
		}
		else if (command == "pode") { // NEW
			this.say("Eu não concordo!");
		}
	}

	if (this.botFunctions && this.suggestedTopic && text == "1") {
		this.voters[name] = 1;
		console.log("Votes are now " + this.voteCount());
	}

	if (/thank.*topic\s*bot/.test(text)) {
		this.say(this.translations.botThanks + " " + name + ".");
	}
};

topicbot.endSuggestedTopicElection = function() {
	var votes = this.voteCount();
	this.say(this.translations.votesCounted + " " + votes + " " + this.translations.votesFor + " '" + this.suggestedTopic + "'.");

	if (votes >= this.requiredVotes) {
		this.topic = this.suggestedTopic;
		this.say(this.translations.themeNew + " '" + this.topic + "'!");
	}
	else if (this.topic) {
		this.say(this.translations.themeKeep + " '" + this.topic + "'.");
	}
	else {
		this.say(this.translations.themeKeep + " " + this.translations.noTheme);
	}

	this.suggestedTopic = null;
	this.requiredVotes = 0;
	this.voters = null;
};

topicbot.say = function(msg) {
	turntable[topicbot.sendMessageName]({
		api: "room.speak",
		roomid: topicbot.room.roomId,
		text: decodeURIComponent(escape(msg))
	});
};

topicbot.upVote = function() {
	console.log("Upvoting");
	topicbot.roomManager.callback("upvote");
}

topicbot.downVote = function() {
	console.log("Downvoting");
	topicbot.roomManager.callback("downvote");
}

topicbot.getUserByName = function(name) {
	var users = this.room.users;

	for (var i in users) {
		if (users.hasOwnProperty(i)) {
			if (users[i].name == name) {
				return users[i];
			}
		}
	}

	return null;
}

topicbot.bootUser = function(name) {
	var user = this.getUserByName(name);

	if (!user) {
		this.say("There's no '" + user + "' in this room.");
	}
	else {
		this.say("Booting " + name);
		topicbot.roomManager.callback("boot_user", user.userid);
	}
}

topicbot.bootCurrentDj = function() {
	this.say("Booting current DJ");
	topicbot.roomManager.callback("boot_user",this.room.currentDj);
}

// #NEW

var lang = {
	en: {
		botHello: "OHAI! I'm topicbot.  I'll help us keep track of this room's theme.",
		botLanguage: "I am speakng English",
		botThanks: "You're welcome",
		botVersion: "I am now version",
		decksFull: "songs when the decks are full.",
		djsCanPlay: "DJs can only play",
		goodLuck: "Good Luck",
		help: "The commands are: !bonus, !similar, !suggest, !theme, !offtheme and of course !help",
		hey: "hey",
		jumpIn: "Feel the vibe and if you like it, jump in and play something with the theme",
		jumpInNoTheme: "Jump in, there's a couple open slots.  Suggest a theme by saying !suggest",
		make: "Make your own damn",
		maxSongs: "and you've hit the song limit.  Make this your last song.",
		niceWork: "Nice! Extra point",
		notFound: "Nothing found, try again",
		noTheme: "no theme.",
		roomBoot: "has been playing for too long.  Attempting boot.  Learn to share!",
		roomFull: "The room is full",
		setTheme: "The theme has been set to",
		songLimit: "The song limit is now",
		suggestQuestion: "What are you suggesting?  Try \"!suggest Songs about cars\"",
		suggestedTopic: "We're already voting for",
		themeCurrent: "The current theme is:",
		themeKeep: "Sorry. We're staying with",
		themeNew: "The theme is now",
		themeNotSet: "There is no theme set.",
		themeOffBot: "You're off theme!! Please play songs that match",
		themeOffUser: "says this is off theme.  Do you agree?  Say !offtheme if so!",
		themeSuggest: "There's no theme set for this room.  Use !suggest to suggest one.",
		tryThis: "Try this song: ",
		userRemeberTheme: "Remember to play songs with the theme",
		userSuggestBonus: "says this track deserves extra bonus love.  Say !bonus if you agree!",
		userThemeChange: "wants to change the theme to",
		votesChange: "vote(s) to change.  Say 1 to vote yes.",
		votesCounted: "I counted",
		votesFor: "for",
		votesNeed: "It need",
		votesReminder: "remember: If you like the song playing, click the \"Awesome\" button. Be Nice!",
		waitFinish: "Please wait for that to finish.",
		welcome: "Welcome"
	},
	pt: {
		botHello: "Olá! Eu sou um robozinho. Vou ajudar a manter o tema dessa sala e distribuir amor.",
		botLanguage: "Eu estou falando Português",
		botThanks: "Muito obrigado",
		botVersion: "Estou na versão",
		decksFull: "músicas quando as pick-ups estão lotadas",
		djsCanPlay: "DJs podem tocar apenas",
		goodLuck: "Boa sorte",
		help: "Os comandos são: !amor, !similar, !tema, !suggest, !offtheme e claro, !help",
		hey: "hey",
		jumpIn: "Sente a vibe e se você gostar, entra no som e toca alguma música com o tema",
		jumpInNoTheme: "Entra no som e toca uma música boa. Sugira um tema digitando: !suggest Seu Tema",
		make: "Faça sua próprio",
		maxSongs: "e você atingiu o limite de músicas. Que essa seja sua última música..",
		niceWork: "Boa. Ponto extra",
		notFound: "Nenhum resultado. Tente novamente!",
		noTheme: "nenhum tema.",
		roomBoot: "já tocou muito tempo. Tentando remover. Aprenda a dividir!",
		roomFull: "A sala está cheia",
		setTheme: "O tema foi decidido como",
		songLimit: "O limite de músicas é",
		suggestedTopic: "Já estamos votando para",
		suggestQuestion: "O que você está sugerindo? Tente \"!suggest Músicas sobre carros\"",
		themeCurrent: "O tema atual é:",
		themeKeep: "Desculpa. Vamos continuar com",
		themeNew: "O tema agora é",
		themeNotSet: "Não há tema definido.",
		themeOffBot: "Você está fora do tema!! Toque músicas que combine com",
		themeOffUser: "disse que você está fora do tema. Alguem concorda?  Se sim, digite: !offtheme",
		themeSuggest: "Essa sala está sem tema. Sugira um tema digitando: !suggest Seu Tema",
		tryThis: "Tente essa música: ",
		userRemeberTheme: "Lembre-se de tocar músicas com o tema",
		userSuggestBonus: " disse que essa música merece amor. Se você concorda, digite: !amor",
		userThemeChange: "quer mudar o tema pra",
		votesChange: "voto(s) para mudar. Pra votar sim, digite: 1.",
		votesCounted: "Eu contei",
		votesFor: "para",
		votesNeed: "Ele precisa",
		votesReminder: "lembre-se: Se você gosta da música clique no botão \"Awesome\". Seja legal!",
		waitFinish: "Por favor espere o resultado.",
		welcome: "Bem-vindo(a)"
	}
};


topicbot.translations = lang[topicbot.language];

if (topicbot.botReminder) {
	if (topicbot.reminderTimer) {
		clearInterval(topicbot.reminderTimer);
	}
	topicbot.reminderTimer = setInterval(function() { topicbot.say(topicbot.translations.votesReminder); }, 900000);
}
topicbot.reminder = function() {
	this.say(this.translations.votesReminder);
}

topicbot.artistPlaying = function() {
	var artist = $(".songlog .song:first .songinfo .details div:first").html(); // NEW
	var artist = artist.split(" - ");
	return artist[0];
}

topicbot.autoplay = {
	init: function() {
		if (topicbot.autoplayStatus && topicbot.room.djIds.indexOf(topicbot.room.selfId) > -1  && topicbot.room.djIds.length > 2) {
			this.stop();
		}
		else if (topicbot.autoplayStatus  && topicbot.room.djIds.indexOf(topicbot.room.selfId) == -1 && topicbot.room.djIds.length < 2) {
			this.start();
		}
	},
	start: function() {
		console.log('start djing');
		topicbot.room.becomeDj();
	},
	stop: function() {
		console.log('quit djing');
		topicbot.room.quitDj();
	}
}

topicbot.autoqueue = {
	init: function(status) {
		if (status == 'switch') {
			topicbot.autoqueueStatus = (topicbot.autoqueueStatus ? 0 : 1);
			console.log("autoqueue is " + (topicbot.autoqueueStatus ? 'on' : 'off'));
		}
		else if (status) {
			topicbot.autoqueueStatus = (status == "off" ? 0 : 1);
			console.log("turning autoqueue " + status);
		}
		else {
			console.log("autoqueue is " + (topicbot.autoqueueStatus ? 'on' : 'off'));
		}
		
		if (topicbot.autoqueueStatus) {
			turntable.addEventListener("soundstart", function() {
				topicbot.autoqueue.search();
			});
		}
		else if (!topicbot.autoqueueStatus) {
			turntable.removeEventListener("soundstart",turntable.eventListeners.soundstart[2]);
		}
	},
	search: function() {
		topicbot.autoqueueRunning = true;
		this.similarSongs();
	},
	queue: function() {
		if ($(".songlist .addSong").length) {
			$(".songlist .addSong").eq(0).trigger("click");
			setTimeout('$(".doneButton").trigger("click");', 1000);
			topicbot.autoqueueMax = 0;
			topicbot.autoqueueRunning = false;
		}
	},
	similarSongs: function() {
		console.log("autoqueue search similar songs to: " + topicbot.artistPlaying());
		$.get("http://code.gilbarbara.com/similar_song.php?artist=" + topicbot.artistPlaying(), function(data) {
			if (data) {
				if (!$(".songSearch input:visible").length) $(".addSongsButton").trigger("click");
				$(".songSearch input:visible").val(data).submit();
			}
		});
	}
}

topicbot.similarSongs = function() {
	console.log("getting similar songs: to: " + this.artistPlaying());
	if (!topicbot.similarRunning) {
		topicbot.similarRunning = true;
		$.get("http://code.gilbarbara.com/similar_song.php?artist=" + this.artistPlaying(), function(data) {
			if (data) {
				topicbot.say(data ? topicbot.translations.tryThis + data : topicbot.translations.notFound);
				topicbot.similarRunning = false;
			}
		});
	}
}

topicbot.userStatus = function() {
	var user_status = '';
	for(var i in this.songsPlayed) {
		if (i && this.room.users[i]) user_status += this.room.users[i].name + ": " + this.songsPlayed[i] + "<br />";
	}
	return user_status;
}

topicbot.storage = {
	support: function() {
		try {
			return !!localStorage.getItem;
		} catch(e) {
			return false;
		}
	}(),
	backup: function() {
		if(this.support) {
			var preferences = {
				language: topicbot.language,
				topic: topicbot.topic,
				maxSongs: topicbot.maxSongs,
				botFunctions: topicbot.botFunctions,
				botHello: topicbot.botHello,
				botGreeting: topicbot.botGreeting,
				botStage: topicbot.botStage,
				botReminder: topicbot.botReminder,
				freeBonus: topicbot.freeBonus,
				autoplayStatus: topicbot.autoplayStatus,
				autoqueueStatus: topicbot.autoqueueStatus
			};

			localStorage.setItem("TFM_HELPER", "{\"preferences\":" + JSON.stringify(preferences) + ", \"songsPlayed\":" + JSON.stringify(topicbot.songsPlayed) + "}");
		}
	},
	restore: function() {
		if(this.support) {
			var storage = localStorage.getItem("TFM_HELPER");
			if(storage) {
				storage = JSON.parse(storage);
				topicbot.songsPlayed = storage.songsPlayed;
				$.extend(topicbot, storage.preferences);
			}
		}
	}
}

topicbot.ui = {
	self: this,
	init: function() {
		if (!$("#topicbot").length) {
			$("<div/>").attr({ id: 'topicbot' }).css({ position: 'absolute', top: 99, left: 760, backgroundColor: '#161616', color: '#999', padding: 16, width: 150, zIndex: 1001, cursor: 'move'  }).appendTo('#outer');
			$("#topicbot").html("<style type='text/css'>#topicbot button {-moz-border-radius: 2px; -webkit-border-radius: 2px; background-color: #999; border-width: 0; color: #E1E1E1; cursor: pointer; display: inline-block; padding: 3px 6px; }\n#topicbot div {  margin-bottom: 6px; }\n#topicbot span { font-size: 12px; font-style: italic; }\n#topicbot #botOptions { margin-left: 8px; padding-bottom: 6px; }\n</style>").draggable();
			$("<div/>").css({ fontSize: 22, marginBottom: 2 }).html("turntable helper").appendTo("#topicbot");
			$("<div/>").css({ fontSize: 13, fontStyle: 'italic', marginBottom: 8 }).html("version <span id=\"botVersion\">" + topicbot.version + "</span>").appendTo("#topicbot");
			$("<div/>").html("<button type=\"button\" data-command=\"reload\">reload</button>").appendTo("#topicbot");
			$("<div/>").html("<button type=\"button\" data-command=\"start\">restart</button>").appendTo("#topicbot");
			$("<div/>").html("<button type=\"button\" data-command=\"reminder\">reminder</button><br />").appendTo("#topicbot");
			
			$("<div/>").html("<button type=\"button\"onclick=\"$('#botOptions').slideToggle();\">bot options</button>").addClass("botOptions").appendTo("#topicbot");
			$("<div/>").attr('id', 'botOptions').css({ display: 'none' }).appendTo("#topicbot");
			$("<div/>").html("<button type=\"button\" data-command=\"autoqueue\" data-function=\"search\">similar</button>").appendTo("#topicbot");
$("<div/>").html("<button type=\"button\" data-variable=\"botFunctions\">bot status</button> <span id=\"botFunctions\">" + (topicbot.botFunctions ? "on" : "off") + "</span>").appendTo("#botOptions");
			$("<div/>").html("<button type=\"button\" data-variable=\"botHello\">bot hello</button> <span id=\"botHello\">" + (topicbot.botHello ? "on" : "off") + "</span>").appendTo("#botOptions");
			$("<div/>").html("<button type=\"button\" data-variable=\"botGreeting\">bot greeting</button> <span id=\"botGreeting\">" + (topicbot.botGreeting ? "on" : "off") + "</span>").appendTo("#botOptions");
			$("<div/>").html("<button type=\"button\" data-variable=\"botStage\">bot up stage</button> <span id=\"botStage\">" + (topicbot.botStage ? "on" : "off") + "</span>").appendTo("#botOptions");
			$("<div/>").html("<button type=\"button\" data-variable=\"botReminder\">bot reminder</button> <span id=\"botReminder\">" + (topicbot.botReminder ? "on" : "off") + "</span>").appendTo("#botOptions");
			$("<div/>").html("<button type=\"button\" data-variable=\"freeBonus\">free bonus</button> <span id=\"freeBonus\">" + (topicbot.freeBonus ? "on" : "off") + "</span>").appendTo("#botOptions");
			$("<div/>").html("<button type=\"button\" data-variable=\"autoplayStatus\">autoplay</button> <span id=\"autoplayStatus\">" + (topicbot.autoqueueStatus ? "on" : "off") + "</span>").appendTo("#topicbot");
			$("<div/>").html("<button type=\"button\" data-command=\"autoqueue\" data-function=\"init\" data-args=\"switch\">autoqueue</button> <span id=\"autoqueue\">" + (topicbot.autoqueueStatus ? "on" : "off") + "</span>").appendTo("#topicbot");
			$("<div/>").css({ fontSize: 15, marginTop: 8 }).html("<b>User Status</b>:" + "<div id=\"userStatus\">" + topicbot.userStatus() + "</div>").appendTo("#topicbot");
			$("#topicbot button:data").click(function() {
				if ($(this).data('command')) {
					if ($(this).data('function')) topicbot[$(this).data('command')][$(this).data('function')]($(this).data('args'));
					else topicbot[$(this).data('command')]($(this).data('args'));
				}
				else if ($(this).data('variable')) {
					topicbot[$(this).data('variable')] = (topicbot[$(this).data('variable')] ? false : true);
					console.log($(this).data('variable') + " is " + (topicbot[$(this).data('variable')] ? "on" : "off"));
				}
				if($(this).data('variable') == 'autoplayStatus' ) topicbot.autoplay[topicbot[$(this).data('variable')] ? 'start' : 'stop']();
				topicbot.ui.refresh();
				topicbot.storage.backup();
			});
		}
	},
	refresh: function() {
		if ($("#topicbot").length) {
			$("#botVersion").html(topicbot.version);
			$("#userStatus").html(topicbot.userStatus());
			$("#autoqueue").html(topicbot.autoqueueStatus ? 'on' : 'off');
			$("#autoplayStatus").html(topicbot.autoplayStatus ? 'on' : 'off');
			$("#botFunctions").html(topicbot.botFunctions ? 'on' : 'off');
			$("#botHello").html(topicbot.botHello ? 'on' : 'off');
			$("#botGreeting").html(topicbot.botGreeting ? 'on' : 'off');
			$("#botStage").html(topicbot.botStage ? 'on' : 'off');
			$("#botReminder").html(topicbot.botReminder ? 'on' : 'off');
			$("#freeBonus").html(topicbot.freeBonus ? 'on' : 'off');
		}
	},
	destroy: function() {
		$("#topicbot").remove();
	}
}

if (!topicbot.started) {
	topicbot.start();
}
else {
	console.log("topicbot version is now " + topicbot.version);
	topicbot.ui.refresh();
}

if (topicbot.refreshRoomTimer) {
	clearInterval(topicbot.refreshRoomTimer);
}
topicbot.refreshRoomTimer = setInterval(function() { topicbot.refreshRoom(); }, 1800000);
