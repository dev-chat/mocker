-- Moonbeam Memory Seed — Phase 1 (cleaned, condensed)
-- Run against the production database to populate initial memories.
-- Each user gets 5-8 of their strongest, most distinctive observations.
-- PII (names, employers, medical info, specific locations) has been removed.

-- JR-15 (userIdId: 4)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(4, 'T2ZV0GCNS', 'Repeatedly uses Moonbeam to ask factual and practical questions — tire lifespan, medication dosing, stock prices, HVAC profitability, VPN tracking — treating it as a quick-reference utility.', NOW(), NOW()),
(4, 'T2ZV0GCNS', 'Has asked Moonbeam to settle arguments or validate his position multiple times, including asking it to confirm political voting patterns and rate how correct he was about AI workflows.', NOW(), NOW()),
(4, 'T2ZV0GCNS', 'Repeatedly advocates for AI as a productivity tool at work. Uses Sonnet daily, is vibe coding a vulnerability management tool, encourages engineers to use AI, and sits on an AI Council.', NOW(), NOW()),
(4, 'T2ZV0GCNS', 'Uses the carpenter/tool analogy when defending AI coding tools — comparing developers who resist AI to a carpenter refusing to use a bandsaw or nailgun. Used this in at least two separate conversations.', NOW(), NOW()),
(4, 'T2ZV0GCNS', 'Sends messages in rapid-fire bursts of short one-liners, often 4-8 messages in quick succession rather than composing longer single messages.', NOW(), NOW()),
(4, 'T2ZV0GCNS', 'Organizes and pushes for in-person D&D sessions with the group. Has a starter kit and an advanced campaign, prefers in-person play over virtual.', NOW(), NOW()),
(4, 'T2ZV0GCNS', 'Runs Ubuntu Linux as his primary OS, repeatedly says Windows stinks and Ubuntu is the only distro worth using. Dual-boots Windows reluctantly for gaming.', NOW(), NOW()),
(4, 'T2ZV0GCNS', 'Repeatedly asks Moonbeam questions and then immediately roasts or mocks its responses — a pattern of using it while simultaneously dunking on it.', NOW(), NOW());

-- Drew (userIdId: 13)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(13, 'T2ZV0GCNS', 'Is a Jets fan and repeatedly expresses frustration and despair about the Jets. At one point proposed burning all Jets jerseys and switching to the Bills.', NOW(), NOW()),
(13, 'T2ZV0GCNS', 'Follows Manchester City in the Premier League regularly, tracking their title race position and discussing specific players.', NOW(), NOW()),
(13, 'T2ZV0GCNS', 'Actively plays and discusses a wide variety of video games — Arc Raiders, Battlefield, Hytale, Expedited 33 (which he called the best RPG he has ever played), Fortnite, Valheim, Sea of Stars.', NOW(), NOW()),
(13, 'T2ZV0GCNS', 'Repeatedly practices and uses Spanish phrases in the chat, getting Moonbeam to translate for him. Has an ongoing interest in learning Spanish.', NOW(), NOW()),
(13, 'T2ZV0GCNS', 'Works night shifts. References working nights, getting called in, and sleep schedule issues.', NOW(), NOW()),
(13, 'T2ZV0GCNS', 'Hosts gatherings at his house for the group, including Super Bowl parties. Coordinates timing and food.', NOW(), NOW()),
(13, 'T2ZV0GCNS', 'Repeatedly ribs and teases specific users — baoui about being unemployed, patrick with sports banter, JR-15 about being wrong. The tone is affectionate trash-talking.', NOW(), NOW()),
(13, 'T2ZV0GCNS', 'Uses Moonbeam in a straightforward, utilitarian way — looks up sports records, gets quick factual answers, and translates Spanish phrases.', NOW(), NOW());

-- lebage (userIdId: 18)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(18, 'T2ZV0GCNS', 'Repeatedly discusses and shares AI coding tools, especially Claude Code — talks about configuration, skills, sub-agents, token limits, and his Claude Max subscription.', NOW(), NOW()),
(18, 'T2ZV0GCNS', 'Frequently debates AI impact on software engineering with JR-15, where lebage takes the more bullish position on AI replacing traditional coding.', NOW(), NOW()),
(18, 'T2ZV0GCNS', 'Uses Moonbeam regularly to settle arguments, ask factual questions, and get context — e.g., asking it to adjudicate who is right in a debate.', NOW(), NOW()),
(18, 'T2ZV0GCNS', 'Actively trades options and follows markets — discusses call options, earnings plays, and stock picks on META, RTX, NVDA, Intel, and others.', NOW(), NOW()),
(18, 'T2ZV0GCNS', 'Has a contentious but friendly dynamic with JR-15 — they argue frequently about AI, tech, and politics, but also share links and banter constantly.', NOW(), NOW()),
(18, 'T2ZV0GCNS', 'Repeatedly discusses Wispr Flow (voice-to-text dictation tool), mentioning he uses it heavily.', NOW(), NOW()),
(18, 'T2ZV0GCNS', 'Repeatedly discusses Moonbeam development with JR-15 and whorne89 in the tech channel. Has said moonbeam rocks.', NOW(), NOW());

-- BollerTime (userIdId: 10)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(10, 'T2ZV0GCNS', 'Repeatedly discusses stock market and investing topics — NVDA holdings, Fed policy, earnings reports, ETFs, expense ratios, RSUs, and portfolio management.', NOW(), NOW()),
(10, 'T2ZV0GCNS', 'Actively participates in dynasty fantasy football across multiple leagues, frequently discussing trades and rookie drafts.', NOW(), NOW()),
(10, 'T2ZV0GCNS', 'Is a Knicks fan and posts regularly about Knicks games, particularly during playoffs.', NOW(), NOW()),
(10, 'T2ZV0GCNS', 'Is a Jets fan and repeatedly expresses frustration about the team.', NOW(), NOW()),
(10, 'T2ZV0GCNS', 'Follows Formula 1 and posts in an F1 channel. Has expressed dislike for Lance Stroll and Red Bull, showed excitement about Yuki Tsunoda.', NOW(), NOW()),
(10, 'T2ZV0GCNS', 'Repeatedly discusses personal finance — 401k mega backdoor conversions, HSA strategy, HELOC rates, home insurance costs, tax complexity.', NOW(), NOW()),
(10, 'T2ZV0GCNS', 'Repeatedly organizes and coordinates group hangouts and bro football Sundays.', NOW(), NOW());

-- ЈР / Cyrillic JP (userIdId: 15)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(15, 'T2ZV0GCNS', 'Repeatedly discusses NVIDIA DLSS technology, GPU hardware (5090, 5080), monitor specs (4K vs 1440p, OLED), and PC building details.', NOW(), NOW()),
(15, 'T2ZV0GCNS', 'Regularly plays and discusses WoW Classic/TBC, including class selection, leveling professions, and pre-raid BiS gear.', NOW(), NOW()),
(15, 'T2ZV0GCNS', 'Plays the military simulator game Squad repeatedly and tries to get others to join. Also plays Gray Zone Warfare.', NOW(), NOW()),
(15, 'T2ZV0GCNS', 'Interacts with Moonbeam by asking factual questions with casual irreverent language.', NOW(), NOW()),
(15, 'T2ZV0GCNS', 'Repeatedly discusses Apple products with knowledgeable detail.', NOW(), NOW()),
(15, 'T2ZV0GCNS', 'Has a back-and-forth dynamic with JR-15 across nearly every conversation.', NOW(), NOW()),
(15, 'T2ZV0GCNS', 'Has a recurring dynamic with lebage where lebage calls JP Reddit and JP pushes back.', NOW(), NOW());

-- ckortbaoui (userIdId: 7)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(7, 'T2ZV0GCNS', 'Works in cybersecurity, specifically in threat detection and security operations.', NOW(), NOW()),
(7, 'T2ZV0GCNS', 'Has a combative but affectionate dynamic with JR-15. They trade insults constantly but also share work talk and career advice.', NOW(), NOW()),
(7, 'T2ZV0GCNS', 'Regularly asks Moonbeam factual and trivia questions — uses the bot as a quick reference tool.', NOW(), NOW()),
(7, 'T2ZV0GCNS', 'Mentions home improvement and DIY projects repeatedly — bathroom remodel, pressure washing, flooring, fireplace cleaning.', NOW(), NOW()),
(7, 'T2ZV0GCNS', 'Participates in jiu jitsu / BJJ.', NOW(), NOW()),
(7, 'T2ZV0GCNS', 'Interested in cars and car culture. Owns a Golf R.', NOW(), NOW()),
(7, 'T2ZV0GCNS', 'Discusses personal finance topics — 529 vs Roth for kids, 401k rollovers, credit card optimization.', NOW(), NOW());

-- El Niño (userIdId: 11)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(11, 'T2ZV0GCNS', 'Repeatedly asks Moonbeam practical questions — house maintenance, cooking, sports stats, TV schedules. Uses the bot as a quick-lookup tool.', NOW(), NOW()),
(11, 'T2ZV0GCNS', 'Frequently discusses homeownership issues — toilets, boilers, fences, gutters, sprinklers, ceiling repairs, deer damage.', NOW(), NOW()),
(11, 'T2ZV0GCNS', 'Actively learning Unity game development and C# programming as a hobby.', NOW(), NOW()),
(11, 'T2ZV0GCNS', 'Plays PC games regularly with the group — Valheim (390 hours), Deep Rock Galactic (300 hours), Division 2, Battlefield, Gray Zone Warfare, V Rising.', NOW(), NOW()),
(11, 'T2ZV0GCNS', 'Interacts most frequently and casually with JR-15.', NOW(), NOW()),
(11, 'T2ZV0GCNS', 'Talks about grilling and charcoal cooking repeatedly.', NOW(), NOW()),
(11, 'T2ZV0GCNS', 'Actively plans group trips — organized a Colorado trip in summer 2025.', NOW(), NOW()),
(11, 'T2ZV0GCNS', 'Refers to other users by nicknames — calls Drew ginger, uses milau for Artiste, baoui for ckortbaoui, Sarge for patrick_odowd, and Flon for JR-15.', NOW(), NOW());

-- g3 (userIdId: 14)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(14, 'T2ZV0GCNS', 'Repeatedly posts Douyin (Chinese TikTok) links, often with Chinese text and brief English commentary.', NOW(), NOW()),
(14, 'T2ZV0GCNS', 'References having Chinese friends and engaging with Chinese culture and language — posting in Chinese characters, mentioning Chinese homies, referencing WeChat.', NOW(), NOW()),
(14, 'T2ZV0GCNS', 'Actively involved in multiple fantasy football leagues, including a guillotine league format.', NOW(), NOW()),
(14, 'T2ZV0GCNS', 'Follows the New York Mets, commenting on games and players.', NOW(), NOW()),
(14, 'T2ZV0GCNS', 'Has a recurring interest in cycling and cycling culture.', NOW(), NOW()),
(14, 'T2ZV0GCNS', 'Engages with JR-15 more than almost any other user in steady back-and-forth banter.', NOW(), NOW());

-- Hawk (userIdId: 3)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(3, 'T2ZV0GCNS', 'Dedicated PC gamer who repeatedly discusses Battlefield games, Sea of Thieves (1400+ hours), Grey Zone Warfare, Insurgency, Cyberpunk 2077, Overwatch, and WoW.', NOW(), NOW()),
(3, 'T2ZV0GCNS', 'Frequently tries to recruit friends to play together, tagging people with messages like its overwatch time or tonight we ride.', NOW(), NOW()),
(3, 'T2ZV0GCNS', 'Recurring pattern of complaining about games being poorly optimized, criticizing DLSS as a crutch.', NOW(), NOW()),
(3, 'T2ZV0GCNS', 'Repeatedly and vocally states that Elden Ring sucks and is boring.', NOW(), NOW()),
(3, 'T2ZV0GCNS', 'Engages with Moonbeam in a mostly dismissive or mocking way — telling it to shut up.', NOW(), NOW()),
(3, 'T2ZV0GCNS', 'Enjoys modding games, particularly Cyberpunk 2077.', NOW(), NOW());

-- bliff182 (userIdId: 9)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(9, 'T2ZV0GCNS', 'Repeatedly discusses movies in a dedicated movie channel, offering takes on Oscar nominees, actor performances, and award predictions.', NOW(), NOW()),
(9, 'T2ZV0GCNS', 'Frequently asks Moonbeam factual questions — movie trivia, weather forecasts, flight status. Uses the bot as a quick-reference tool.', NOW(), NOW()),
(9, 'T2ZV0GCNS', 'Participates in an active D&D campaign. Also plays Baldur''s Gate 3.', NOW(), NOW()),
(9, 'T2ZV0GCNS', 'Has a recurring engagement with movies and film culture that goes deeper than casual viewing — references Cannes awards, quotes Roger Ebert reviews, discusses The Rewatchables podcast.', NOW(), NOW()),
(9, 'T2ZV0GCNS', 'References baoui as a long-time friend going back to roughly age 12.', NOW(), NOW()),
(9, 'T2ZV0GCNS', 'Repeatedly compliments Moonbeam''s outputs — Good job moonbeam, I''ve come around on her.', NOW(), NOW());

-- Duke Cash (userIdId: 17)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(17, 'T2ZV0GCNS', 'Repeatedly talks about his Plex media server setup — customizing posters, adding overlays, managing storage, running upgradinatorr.', NOW(), NOW()),
(17, 'T2ZV0GCNS', 'Runs an Unraid home server with 60+ TB of media storage across multiple drives.', NOW(), NOW()),
(17, 'T2ZV0GCNS', 'Regularly asks Moonbeam factual questions — uses it as a quick lookup tool.', NOW(), NOW()),
(17, 'T2ZV0GCNS', 'Has been actively exploring AI tools — tried running local models via Ollama, uses Claude free tier, tested whorne89''s Resonance speech-to-text app.', NOW(), NOW()),
(17, 'T2ZV0GCNS', 'Plays Arc Raiders extensively with JR-15 and El Nino. Describes himself as a loot whore who avoids PvP.', NOW(), NOW()),
(17, 'T2ZV0GCNS', 'Has told Moonbeam not to make memories about him and attempted to unsubscribe from the bot''s memory feature.', NOW(), NOW()),
(17, 'T2ZV0GCNS', 'Repeatedly references piracy infrastructure openly — Radarr, Sonarr, qBittorrent.', NOW(), NOW());

-- Brandon Broccolini (userIdId: 12)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(12, 'T2ZV0GCNS', 'Repeatedly tells people don''t be mean or be nice or every1 relax when others are arguing or roasting each other.', NOW(), NOW()),
(12, 'T2ZV0GCNS', 'Frequently eggs on fights while simultaneously playing peacemaker — fight fight fight then don''t be mean.', NOW(), NOW()),
(12, 'T2ZV0GCNS', 'Actively participates in fantasy football. Repeatedly complains about being cooked.', NOW(), NOW()),
(12, 'T2ZV0GCNS', 'Repeatedly asks people for their flight numbers so he can track their flights.', NOW(), NOW()),
(12, 'T2ZV0GCNS', 'Universally called bdon by the group.', NOW(), NOW()),
(12, 'T2ZV0GCNS', 'Repeatedly offers practical handyman-type advice or help. Others describe him as probably the most knowledgeable about hands-on tasks.', NOW(), NOW()),
(12, 'T2ZV0GCNS', 'Holds a scheduling and administrative role in the fantasy football league.', NOW(), NOW());

-- Neal (userIdId: 6)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(6, 'T2ZV0GCNS', 'Repeatedly asks Moonbeam factual and trivia-style questions across many channels — history, science, politics, gaming.', NOW(), NOW()),
(6, 'T2ZV0GCNS', 'Occasionally tests or provokes Moonbeam with non-standard prompts: pretend you are high on bath salts, what''s your greatest weakness.', NOW(), NOW()),
(6, 'T2ZV0GCNS', 'Has repeatedly stated a class-consciousness framing of politics — Working Class vs Investor Class, classism is the parent of politics.', NOW(), NOW()),
(6, 'T2ZV0GCNS', 'Is a regular at trivia nights and karaoke. Participates in Renaissance faire activities.', NOW(), NOW()),
(6, 'T2ZV0GCNS', 'Active gamer — Helldivers 2, V-Rising, WoW, Morrowind/Elder Scrolls, Battlefield, Oblivion.', NOW(), NOW()),
(6, 'T2ZV0GCNS', 'Has mentioned reading Warhammer (Horus Heresy) books multiple times.', NOW(), NOW()),
(6, 'T2ZV0GCNS', 'Uses Inshallah as a recurring catchphrase. Uses ironic internet slang and meme-speak frequently.', NOW(), NOW()),
(6, 'T2ZV0GCNS', 'Drops historical and literary references regularly — quoting Catullus in Latin, referencing Thomas Sankara, the Battle of Blair Mountain.', NOW(), NOW());

-- patrick_odowd (userIdId: 32)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(32, 'T2ZV0GCNS', 'Follows the Premier League closely with particular attention to Manchester United, Arsenal, and Tottenham. Repeatedly mocks Tottenham''s poor form.', NOW(), NOW()),
(32, 'T2ZV0GCNS', 'Is a published author who has done public readings and events, worked with a publicist, and secured a literary agent.', NOW(), NOW()),
(32, 'T2ZV0GCNS', 'Is a Yankees fan who follows the team closely during baseball season.', NOW(), NOW()),
(32, 'T2ZV0GCNS', 'Regularly engages in cooking discussions, especially around grilling and smoking meat. Shops at Costco regularly.', NOW(), NOW()),
(32, 'T2ZV0GCNS', 'Frequently uses the word lib as playful shorthand to tease others.', NOW(), NOW()),
(32, 'T2ZV0GCNS', 'Expressed initial dismissiveness toward Moonbeam but later used AI tools practically — had the robot help him set up server infrastructure.', NOW(), NOW());

-- The Bad Guy (userIdId: 16)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(16, 'T2ZV0GCNS', 'Repeatedly posts in the investing/stocks channel about NVDA, market conditions, and investing strategy.', NOW(), NOW()),
(16, 'T2ZV0GCNS', 'Repeatedly stated that AI will replace software engineering jobs, specifically needling JR-15 about it.', NOW(), NOW()),
(16, 'T2ZV0GCNS', 'Repeatedly and emphatically states he dislikes the French and France.', NOW(), NOW()),
(16, 'T2ZV0GCNS', 'Said Braveheart is his favorite movie of all time.', NOW(), NOW()),
(16, 'T2ZV0GCNS', 'Expresses a recurring Europe sucks position while simultaneously traveling there often.', NOW(), NOW()),
(16, 'T2ZV0GCNS', 'Frequently tags along with JR-15''s tech and AI discussions, taking the contrarian your job is going away angle.', NOW(), NOW());

-- whorne89 (userIdId: 8)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(8, 'T2ZV0GCNS', 'Repeatedly discusses and compares AI models and tools — ChatGPT, Claude, Gemini, GPT-4o, GPT-5, Claude Code.', NOW(), NOW()),
(8, 'T2ZV0GCNS', 'Consistently defends Google and Gemini against group criticism — saying gemini isnt good is fucking stupid.', NOW(), NOW()),
(8, 'T2ZV0GCNS', 'Uses an Android phone (Samsung) and repeatedly champions Android over iPhone.', NOW(), NOW()),
(8, 'T2ZV0GCNS', 'Actively involved in building and maintaining Moonbeam. Discussed awareness features, stress testing, planning binaries, writing prompts.', NOW(), NOW()),
(8, 'T2ZV0GCNS', 'Recurring pattern of complaining about ChatGPT and OpenAI quality declining — as an LLM it has fallen straight off a cliff.', NOW(), NOW()),
(8, 'T2ZV0GCNS', 'Frequently participates in the cars channel — owns a Subaru STI and a Genesis, discusses car maintenance and repairs.', NOW(), NOW()),
(8, 'T2ZV0GCNS', 'Repeatedly maxes out AI subscription usage — literally max out my usage the second it becomes available.', NOW(), NOW()),
(8, 'T2ZV0GCNS', 'Serves as quality control voice for Moonbeam — why is moonbeam significantly more retarded lately.', NOW(), NOW());

-- stoners_4_jesuz (userIdId: 21)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(21, 'T2ZV0GCNS', 'Repeatedly talks about ultra-endurance running events — completed a 100-mile race, posted a 50-mile PR.', NOW(), NOW()),
(21, 'T2ZV0GCNS', 'Lives in Colorado in a mountain area. Repeatedly references hiking, biking, skiing, and outdoor activities.', NOW(), NOW()),
(21, 'T2ZV0GCNS', 'Repeatedly expresses disdain for his day job — jokes about not working, having a script to appear active.', NOW(), NOW()),
(21, 'T2ZV0GCNS', 'Engages heavily with JR-15 across almost every conversation — by far his most frequent conversation partner.', NOW(), NOW()),
(21, 'T2ZV0GCNS', 'Repeatedly discusses side business and e-commerce ideas — organic sales, email deliverability, product sourcing.', NOW(), NOW()),
(21, 'T2ZV0GCNS', 'Repeatedly engages in debates about React vs Angular with JR-15 — Angular made me HATE coding.', NOW(), NOW()),
(21, 'T2ZV0GCNS', 'References cannabis use casually and matter-of-factly. Uses the phrase vibe coding to describe building personal projects with AI.', NOW(), NOW());

-- csheridan (userIdId: 22)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(22, 'T2ZV0GCNS', 'Repeatedly greets the group chat with variations of good morning libs or morning libtards.', NOW(), NOW()),
(22, 'T2ZV0GCNS', 'Works in advertising sales and repeatedly shares quota progress, bonus multiplier status, and commission details.', NOW(), NOW()),
(22, 'T2ZV0GCNS', 'Enthusiastic Rutgers fan who repeatedly organizes watch parties and buys game tickets.', NOW(), NOW()),
(22, 'T2ZV0GCNS', 'Provides amateur weather forecasting to the group on a recurring basis — referencing European and American models.', NOW(), NOW()),
(22, 'T2ZV0GCNS', 'Is a Yankees fan who follows them closely.', NOW(), NOW()),
(22, 'T2ZV0GCNS', 'Organized and ran a group lottery pool (Powerball) multiple times.', NOW(), NOW()),
(22, 'T2ZV0GCNS', 'Regularly shares cooking photos and recipes, particularly salmon dishes.', NOW(), NOW());

-- Artiste (userIdId: 25)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(25, 'T2ZV0GCNS', 'Works as a teacher and regularly posts about classroom experiences.', NOW(), NOW()),
(25, 'T2ZV0GCNS', 'Frequently uses Moonbeam to ask provocative or humorous questions.', NOW(), NOW()),
(25, 'T2ZV0GCNS', 'Buys and discusses cryptocurrency, particularly Bitcoin and XRP.', NOW(), NOW()),
(25, 'T2ZV0GCNS', 'Plays in multiple fantasy football leagues.', NOW(), NOW()),
(25, 'T2ZV0GCNS', 'Refers to himself as Italian-American repeatedly.', NOW(), NOW()),
(25, 'T2ZV0GCNS', 'Frequently frames everyday situations using gaming and RPG language.', NOW(), NOW()),
(25, 'T2ZV0GCNS', 'Is a Jets fan — repeatedly laments being one.', NOW(), NOW());

-- patrick.obrien908 (userIdId: 35)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(35, 'T2ZV0GCNS', 'Repeatedly and consistently discusses Everton FC across the entire message history. Repeatedly discusses Everton''s relegation concerns with resigned acceptance.', NOW(), NOW()),
(35, 'T2ZV0GCNS', 'Frequently discusses and live-comments Premier League, Champions League, and broader European football.', NOW(), NOW()),
(35, 'T2ZV0GCNS', 'Is a Yankees fan.', NOW(), NOW()),
(35, 'T2ZV0GCNS', 'References the Atlanta Falcons as his NFL team, repeatedly expressing frustration.', NOW(), NOW()),
(35, 'T2ZV0GCNS', 'Engages with beer and pub culture — Guinness, Chimay, Belgian and English beer.', NOW(), NOW()),
(35, 'T2ZV0GCNS', 'Watches and discusses TV shows — The Leftovers (favorite show), Severance, Last of Us, Fallout, Fargo, Sopranos.', NOW(), NOW()),
(35, 'T2ZV0GCNS', 'Uses that whips, that rocks, hell yeah, and sick as go-to positive reactions.', NOW(), NOW()),
(35, 'T2ZV0GCNS', 'Owns and frequently uses a Steam Deck for gaming. Repeatedly expresses enthusiasm for the game Hitman.', NOW(), NOW());

-- Vinceborg 2050 (userIdId: 41)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(41, 'T2ZV0GCNS', 'Repeatedly discusses Arsenal FC across dozens of conversations, analyzing matches in detail including player performance, tactical patterns, and xG stats.', NOW(), NOW()),
(41, 'T2ZV0GCNS', 'Frequently engages with patrick_odowd and patrick.obrien908 specifically about Premier League football.', NOW(), NOW()),
(41, 'T2ZV0GCNS', 'Repeatedly mocks Tottenham Hotspur — St Totteringham''s Day, relegation troubles.', NOW(), NOW()),
(41, 'T2ZV0GCNS', 'Discusses Formula 1 extensively and with deep technical knowledge, including the business side — licensing fees, promoter economics, TV contracts.', NOW(), NOW()),
(41, 'T2ZV0GCNS', 'Repeatedly mentions having very limited free time due to parenting and work.', NOW(), NOW()),
(41, 'T2ZV0GCNS', 'Shares music — hip-hop producers, Pete Rock, Big L, Kutmasta Kurt, 100 gecs, Floating Points.', NOW(), NOW()),
(41, 'T2ZV0GCNS', 'Writes in multi-sentence messages with detailed analysis rather than one-liners.', NOW(), NOW());

-- chattkaslack (userIdId: 31)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(31, 'T2ZV0GCNS', 'Repeatedly posts about the New York Mets — play-by-play commentary, trade analysis, roster opinions.', NOW(), NOW()),
(31, 'T2ZV0GCNS', 'Regularly shares news articles in the politics channel, predominantly critical of the current administration.', NOW(), NOW()),
(31, 'T2ZV0GCNS', 'Engages in recurring political arguments with The Bad Guy.', NOW(), NOW()),
(31, 'T2ZV0GCNS', 'Lives in the DC area. Reports local weather conditions to the group repeatedly.', NOW(), NOW()),
(31, 'T2ZV0GCNS', 'Watches and comments on NBA playoff basketball, particularly Knicks games.', NOW(), NOW()),
(31, 'T2ZV0GCNS', 'Plays TimeGuessr.', NOW(), NOW());

-- robbie.carter (userIdId: 19)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(19, 'T2ZV0GCNS', 'Lives in Texas. Complaints about the grid reliability and heat.', NOW(), NOW()),
(19, 'T2ZV0GCNS', 'Consistently posted about Notre Dame football throughout fall 2025.', NOW(), NOW()),
(19, 'T2ZV0GCNS', 'Actively participated in fantasy football and gaming discussions — Battlefield, Battlefront 2.', NOW(), NOW());

-- jonk. (userIdId: 26)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(26, 'T2ZV0GCNS', 'Training for a marathon, does early morning runs.', NOW(), NOW()),
(26, 'T2ZV0GCNS', 'Consistently posted about the Mets.', NOW(), NOW()),
(26, 'T2ZV0GCNS', 'Shared and discussed music — emo/punk preference, strong dislike for EDM with singing.', NOW(), NOW()),
(26, 'T2ZV0GCNS', 'Discussed tabletop RPGs extensively, advocating for Dungeon World over D&D.', NOW(), NOW());

-- rgerrity4 (userIdId: 24)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(24, 'T2ZV0GCNS', 'Posted prolifically about the Yankees across 2025.', NOW(), NOW()),
(24, 'T2ZV0GCNS', 'Won the group''s fantasy football championship in late 2025.', NOW(), NOW()),
(24, 'T2ZV0GCNS', 'Identified as a Lions fan in NFL discussions.', NOW(), NOW());

-- foxZdoxZ (userIdId: 2)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(2, 'T2ZV0GCNS', 'Participated in hip hop music discussions.', NOW(), NOW()),
(2, 'T2ZV0GCNS', 'Mentioned doing a blacksmithing class.', NOW(), NOW());

-- jcal (userIdId: 23)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(23, 'T2ZV0GCNS', 'Referenced the Patriots as his NFL team.', NOW(), NOW()),
(23, 'T2ZV0GCNS', 'Started sports betting in early 2026.', NOW(), NOW());

-- kaskiw911 (userIdId: 51)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(51, 'T2ZV0GCNS', 'Discussed WoW hardcore gameplay — leveling multiple characters to 60 on private servers.', NOW(), NOW()),
(51, 'T2ZV0GCNS', 'Extremely low posting frequency — a lurker.', NOW(), NOW());
