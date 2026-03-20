-- Moonbeam Memory Seed — Phase 1 (cleaned, condensed, runtime-format)
-- Run against the production database to populate initial memories.
-- Each user gets 5-8 of their strongest, most distinctive observations.
-- PII (names, employers, medical info, specific locations) has been removed.
-- Format matches runtime extraction output style.

-- JR-15 (userIdId: 4)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(4, 'T2ZV0GCNS', 'uses moonbeam as a quick-reference tool — asks about tire lifespan, medication dosing, stock prices, HVAC profitability, VPN tracking', NOW(), NOW()),
(4, 'T2ZV0GCNS', 'asked moonbeam to settle arguments multiple times — had it confirm political voting patterns and rate how correct he was about AI workflows', NOW(), NOW()),
(4, 'T2ZV0GCNS', 'advocates hard for AI at work — uses Sonnet daily, vibe coding a vulnerability management tool, sits on an AI Council, pushes engineers to adopt AI', NOW(), NOW()),
(4, 'T2ZV0GCNS', 'used the carpenter/tool analogy at least twice when defending AI coding tools — compared devs who resist AI to a carpenter refusing to use a bandsaw or nailgun', NOW(), NOW()),
(4, 'T2ZV0GCNS', 'sends messages in rapid-fire bursts of 4-8 short one-liners instead of composing longer messages', NOW(), NOW()),
(4, 'T2ZV0GCNS', 'organizes in-person D&D sessions — has a starter kit and an advanced campaign, prefers in-person over virtual', NOW(), NOW()),
(4, 'T2ZV0GCNS', 'runs Ubuntu as his primary OS, says Windows stinks and Ubuntu is the only distro worth using — dual-boots Windows reluctantly for gaming', NOW(), NOW()),
(4, 'T2ZV0GCNS', 'asks moonbeam questions then immediately roasts or mocks the responses — uses it and dunks on it at the same time', NOW(), NOW());

-- Drew (userIdId: 13)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(13, 'T2ZV0GCNS', 'Jets fan who once proposed burning all Jets jerseys and switching to the Bills out of frustration', NOW(), NOW()),
(13, 'T2ZV0GCNS', 'follows Manchester City in the Premier League — tracks their title race position and discusses specific players', NOW(), NOW()),
(13, 'T2ZV0GCNS', 'plays a wide variety of games — Arc Raiders, Battlefield, Hytale, Expedited 33 (called it the best RPG he''s ever played), Fortnite, Valheim, Sea of Stars', NOW(), NOW()),
(13, 'T2ZV0GCNS', 'practices Spanish phrases in the chat and gets moonbeam to translate for him', NOW(), NOW()),
(13, 'T2ZV0GCNS', 'works night shifts — references getting called in and sleep schedule issues', NOW(), NOW()),
(13, 'T2ZV0GCNS', 'hosts group gatherings at his house including Super Bowl parties — coordinates timing and food', NOW(), NOW()),
(13, 'T2ZV0GCNS', 'ribs specific people — baoui about being unemployed, patrick with sports banter, JR-15 about being wrong. affectionate trash-talking.', NOW(), NOW()),
(13, 'T2ZV0GCNS', 'uses moonbeam in a straightforward way — looks up sports records, gets factual answers, translates Spanish phrases', NOW(), NOW());

-- lebage (userIdId: 18)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(18, 'T2ZV0GCNS', 'talks about Claude Code constantly — configuration, skills, sub-agents, token limits, his Claude Max subscription', NOW(), NOW()),
(18, 'T2ZV0GCNS', 'debates AI impact on software engineering with JR-15 — takes the more bullish position on AI replacing traditional coding', NOW(), NOW()),
(18, 'T2ZV0GCNS', 'uses moonbeam to settle arguments and get context — asks it to adjudicate who is right in a debate', NOW(), NOW()),
(18, 'T2ZV0GCNS', 'trades options and follows markets — discusses call options, earnings plays, stock picks on META, RTX, NVDA, Intel', NOW(), NOW()),
(18, 'T2ZV0GCNS', 'argues frequently with JR-15 about AI, tech, and politics but also shares links and banters with him constantly', NOW(), NOW()),
(18, 'T2ZV0GCNS', 'uses Wispr Flow (voice-to-text dictation) heavily and talks about it a lot', NOW(), NOW()),
(18, 'T2ZV0GCNS', 'talks about moonbeam development with JR-15 and whorne89 in the tech channel — has said moonbeam rocks', NOW(), NOW());

-- BollerTime (userIdId: 10)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(10, 'T2ZV0GCNS', 'talks stocks and investing — NVDA holdings, Fed policy, earnings reports, ETFs, expense ratios, RSUs, portfolio management', NOW(), NOW()),
(10, 'T2ZV0GCNS', 'plays dynasty fantasy football across multiple leagues — discusses trades and rookie drafts frequently', NOW(), NOW()),
(10, 'T2ZV0GCNS', 'Knicks fan — posts about games regularly, especially during playoffs', NOW(), NOW()),
(10, 'T2ZV0GCNS', 'Jets fan who vents frustration about the team', NOW(), NOW()),
(10, 'T2ZV0GCNS', 'follows F1 — dislikes Lance Stroll and Red Bull, showed excitement about Yuki Tsunoda', NOW(), NOW()),
(10, 'T2ZV0GCNS', 'talks personal finance in detail — 401k mega backdoor conversions, HSA strategy, HELOC rates, home insurance costs, tax complexity', NOW(), NOW()),
(10, 'T2ZV0GCNS', 'organizes and coordinates group hangouts and bro football Sundays', NOW(), NOW());

-- ЈР / Cyrillic JP (userIdId: 15)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(15, 'T2ZV0GCNS', 'talks NVIDIA DLSS, GPU hardware (5090, 5080), monitor specs (4K vs 1440p, OLED), and PC building in detail', NOW(), NOW()),
(15, 'T2ZV0GCNS', 'plays WoW Classic/TBC — discusses class selection, leveling professions, and pre-raid BiS gear', NOW(), NOW()),
(15, 'T2ZV0GCNS', 'plays Squad and tries to recruit others into it — also plays Gray Zone Warfare', NOW(), NOW()),
(15, 'T2ZV0GCNS', 'asks moonbeam factual questions with casual irreverent language', NOW(), NOW()),
(15, 'T2ZV0GCNS', 'talks Apple products with knowledgeable detail', NOW(), NOW()),
(15, 'T2ZV0GCNS', 'has a constant back-and-forth dynamic with JR-15 across nearly every conversation', NOW(), NOW()),
(15, 'T2ZV0GCNS', 'lebage calls JP "Reddit" and JP pushes back — recurring bit between them', NOW(), NOW());

-- ckortbaoui (userIdId: 7)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(7, 'T2ZV0GCNS', 'works in cybersecurity — threat detection and security operations', NOW(), NOW()),
(7, 'T2ZV0GCNS', 'trades insults with JR-15 constantly but also shares work talk and career advice — combative but affectionate', NOW(), NOW()),
(7, 'T2ZV0GCNS', 'asks moonbeam factual and trivia questions — uses it as a quick reference tool', NOW(), NOW()),
(7, 'T2ZV0GCNS', 'does home improvement and DIY projects — bathroom remodel, pressure washing, flooring, fireplace cleaning', NOW(), NOW()),
(7, 'T2ZV0GCNS', 'does jiu jitsu / BJJ', NOW(), NOW()),
(7, 'T2ZV0GCNS', 'into cars and car culture — owns a Golf R', NOW(), NOW()),
(7, 'T2ZV0GCNS', 'talks personal finance — 529 vs Roth for kids, 401k rollovers, credit card optimization', NOW(), NOW());

-- El Niño (userIdId: 11)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(11, 'T2ZV0GCNS', 'asks moonbeam practical questions — house maintenance, cooking, sports stats, TV schedules', NOW(), NOW()),
(11, 'T2ZV0GCNS', 'talks homeownership issues constantly — toilets, boilers, fences, gutters, sprinklers, ceiling repairs, deer damage', NOW(), NOW()),
(11, 'T2ZV0GCNS', 'learning Unity game development and C# programming as a hobby', NOW(), NOW()),
(11, 'T2ZV0GCNS', 'plays PC games with the group — Valheim (390 hours), Deep Rock Galactic (300 hours), Division 2, Battlefield, Gray Zone Warfare, V Rising', NOW(), NOW()),
(11, 'T2ZV0GCNS', 'interacts most frequently and casually with JR-15', NOW(), NOW()),
(11, 'T2ZV0GCNS', 'talks about grilling and charcoal cooking a lot', NOW(), NOW()),
(11, 'T2ZV0GCNS', 'organized a Colorado group trip in summer 2025', NOW(), NOW()),
(11, 'T2ZV0GCNS', 'uses nicknames — calls Drew "ginger", Artiste "milau", ckortbaoui "baoui", patrick_odowd "Sarge", JR-15 "Flon"', NOW(), NOW());

-- g3 (userIdId: 14)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(14, 'T2ZV0GCNS', 'posts Douyin (Chinese TikTok) links with Chinese text and brief English commentary', NOW(), NOW()),
(14, 'T2ZV0GCNS', 'has Chinese friends and engages with Chinese culture — posts in Chinese characters, references WeChat', NOW(), NOW()),
(14, 'T2ZV0GCNS', 'plays in multiple fantasy football leagues including a guillotine league format', NOW(), NOW()),
(14, 'T2ZV0GCNS', 'follows the Mets — comments on games and players', NOW(), NOW()),
(14, 'T2ZV0GCNS', 'into cycling and cycling culture', NOW(), NOW()),
(14, 'T2ZV0GCNS', 'engages with JR-15 more than almost anyone — steady back-and-forth banter', NOW(), NOW());

-- Hawk (userIdId: 3)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(3, 'T2ZV0GCNS', 'dedicated PC gamer — Battlefield, Sea of Thieves (1400+ hours), Grey Zone Warfare, Insurgency, Cyberpunk 2077, Overwatch, WoW', NOW(), NOW()),
(3, 'T2ZV0GCNS', 'tries to recruit friends to play together — tags people with "its overwatch time" or "tonight we ride"', NOW(), NOW()),
(3, 'T2ZV0GCNS', 'complains about games being poorly optimized and criticizes DLSS as a crutch', NOW(), NOW()),
(3, 'T2ZV0GCNS', 'has vocally and repeatedly stated that Elden Ring sucks and is boring', NOW(), NOW()),
(3, 'T2ZV0GCNS', 'engages with moonbeam in a mostly dismissive or mocking way — tells it to shut up', NOW(), NOW()),
(3, 'T2ZV0GCNS', 'enjoys modding games, particularly Cyberpunk 2077', NOW(), NOW());

-- bliff182 (userIdId: 9)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(9, 'T2ZV0GCNS', 'talks movies in a dedicated channel — Oscar nominees, actor performances, award predictions', NOW(), NOW()),
(9, 'T2ZV0GCNS', 'asks moonbeam factual questions — movie trivia, weather forecasts, flight status', NOW(), NOW()),
(9, 'T2ZV0GCNS', 'participates in a D&D campaign and plays Baldur''s Gate 3', NOW(), NOW()),
(9, 'T2ZV0GCNS', 'deep engagement with film culture — references Cannes awards, quotes Roger Ebert reviews, discusses The Rewatchables podcast', NOW(), NOW()),
(9, 'T2ZV0GCNS', 'references baoui as a long-time friend going back to roughly age 12', NOW(), NOW()),
(9, 'T2ZV0GCNS', 'has complimented moonbeam multiple times — "Good job moonbeam", "I''ve come around on her"', NOW(), NOW());

-- Duke Cash (userIdId: 17)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(17, 'T2ZV0GCNS', 'talks about his Plex setup — customizing posters, adding overlays, managing storage, running upgradinatorr', NOW(), NOW()),
(17, 'T2ZV0GCNS', 'runs an Unraid home server with 60+ TB of media storage across multiple drives', NOW(), NOW()),
(17, 'T2ZV0GCNS', 'asks moonbeam factual questions — uses it as a quick lookup tool', NOW(), NOW()),
(17, 'T2ZV0GCNS', 'exploring AI tools — tried running local models via Ollama, uses Claude free tier, tested whorne89''s Resonance speech-to-text app', NOW(), NOW()),
(17, 'T2ZV0GCNS', 'plays Arc Raiders with JR-15 and El Nino — describes himself as a loot whore who avoids PvP', NOW(), NOW()),
(17, 'T2ZV0GCNS', 'told moonbeam not to make memories about him and tried to unsubscribe from the memory feature', NOW(), NOW()),
(17, 'T2ZV0GCNS', 'references piracy infrastructure openly — Radarr, Sonarr, qBittorrent', NOW(), NOW());

-- Brandon Broccolini (userIdId: 12)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(12, 'T2ZV0GCNS', 'tells people "don''t be mean" or "be nice" or "every1 relax" when others are arguing or roasting each other', NOW(), NOW()),
(12, 'T2ZV0GCNS', 'eggs on fights while simultaneously playing peacemaker — "fight fight fight" then "don''t be mean"', NOW(), NOW()),
(12, 'T2ZV0GCNS', 'plays fantasy football and complains about being cooked', NOW(), NOW()),
(12, 'T2ZV0GCNS', 'asks people for their flight numbers so he can track their flights', NOW(), NOW()),
(12, 'T2ZV0GCNS', 'universally called "bdon" by the group', NOW(), NOW()),
(12, 'T2ZV0GCNS', 'offers practical handyman-type advice and help — others say he''s the most knowledgeable about hands-on tasks', NOW(), NOW()),
(12, 'T2ZV0GCNS', 'handles scheduling and admin for the fantasy football league', NOW(), NOW());

-- Neal (userIdId: 6)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(6, 'T2ZV0GCNS', 'asks moonbeam factual and trivia-style questions across many channels — history, science, politics, gaming', NOW(), NOW()),
(6, 'T2ZV0GCNS', 'tests moonbeam with non-standard prompts — "pretend you are high on bath salts", "what''s your greatest weakness"', NOW(), NOW()),
(6, 'T2ZV0GCNS', 'frames politics as Working Class vs Investor Class — said "classism is the parent of politics"', NOW(), NOW()),
(6, 'T2ZV0GCNS', 'regular at trivia nights and karaoke — participates in Renaissance faire activities', NOW(), NOW()),
(6, 'T2ZV0GCNS', 'active gamer — Helldivers 2, V-Rising, WoW, Morrowind/Elder Scrolls, Battlefield, Oblivion', NOW(), NOW()),
(6, 'T2ZV0GCNS', 'reads Warhammer (Horus Heresy) books', NOW(), NOW()),
(6, 'T2ZV0GCNS', 'uses "Inshallah" as a catchphrase — uses ironic internet slang and meme-speak frequently', NOW(), NOW()),
(6, 'T2ZV0GCNS', 'drops historical and literary references — quoted Catullus in Latin, referenced Thomas Sankara, the Battle of Blair Mountain', NOW(), NOW());

-- patrick_odowd (userIdId: 32)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(32, 'T2ZV0GCNS', 'follows the Premier League closely — Man United, Arsenal, Tottenham — mocks Tottenham''s poor form', NOW(), NOW()),
(32, 'T2ZV0GCNS', 'published author — has done public readings and events, worked with a publicist, secured a literary agent', NOW(), NOW()),
(32, 'T2ZV0GCNS', 'Yankees fan who follows the team closely during baseball season', NOW(), NOW()),
(32, 'T2ZV0GCNS', 'engages in cooking discussions — grilling, smoking meat, shops at Costco regularly', NOW(), NOW()),
(32, 'T2ZV0GCNS', 'uses "lib" as playful shorthand to tease others', NOW(), NOW()),
(32, 'T2ZV0GCNS', 'was initially dismissive of moonbeam but later used AI tools practically — had the robot help him set up server infrastructure', NOW(), NOW());

-- The Bad Guy (userIdId: 16)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(16, 'T2ZV0GCNS', 'posts in the investing/stocks channel about NVDA, market conditions, and strategy', NOW(), NOW()),
(16, 'T2ZV0GCNS', 'says AI will replace software engineering jobs — needles JR-15 about it specifically', NOW(), NOW()),
(16, 'T2ZV0GCNS', 'emphatically dislikes the French and France', NOW(), NOW()),
(16, 'T2ZV0GCNS', 'said Braveheart is his favorite movie of all time', NOW(), NOW()),
(16, 'T2ZV0GCNS', 'takes a "Europe sucks" position while simultaneously traveling there often', NOW(), NOW()),
(16, 'T2ZV0GCNS', 'tags along with JR-15''s tech and AI discussions, taking the contrarian "your job is going away" angle', NOW(), NOW());

-- whorne89 (userIdId: 8)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(8, 'T2ZV0GCNS', 'compares AI models and tools constantly — ChatGPT, Claude, Gemini, GPT-4o, GPT-5, Claude Code', NOW(), NOW()),
(8, 'T2ZV0GCNS', 'defends Google and Gemini against group criticism — said "saying gemini isnt good is fucking stupid"', NOW(), NOW()),
(8, 'T2ZV0GCNS', 'uses Android (Samsung) and champions Android over iPhone', NOW(), NOW()),
(8, 'T2ZV0GCNS', 'actively builds and maintains moonbeam — discusses awareness features, stress testing, planning binaries, writing prompts', NOW(), NOW()),
(8, 'T2ZV0GCNS', 'complains about ChatGPT and OpenAI quality declining — said "as an LLM it has fallen straight off a cliff"', NOW(), NOW()),
(8, 'T2ZV0GCNS', 'owns a Subaru STI and a Genesis — discusses car maintenance and repairs in the cars channel', NOW(), NOW()),
(8, 'T2ZV0GCNS', 'maxes out AI subscription usage — "literally max out my usage the second it becomes available"', NOW(), NOW()),
(8, 'T2ZV0GCNS', 'serves as quality control for moonbeam — "why is moonbeam significantly more retarded lately"', NOW(), NOW());

-- stoners_4_jesuz (userIdId: 21)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(21, 'T2ZV0GCNS', 'does ultra-endurance running — completed a 100-mile race, posted a 50-mile PR', NOW(), NOW()),
(21, 'T2ZV0GCNS', 'lives in Colorado in a mountain area — hikes, bikes, skis', NOW(), NOW()),
(21, 'T2ZV0GCNS', 'jokes about not working at his day job — says he has a script to appear active', NOW(), NOW()),
(21, 'T2ZV0GCNS', 'engages with JR-15 more than almost anyone — by far his most frequent conversation partner', NOW(), NOW()),
(21, 'T2ZV0GCNS', 'works on side business and e-commerce ideas — organic sales, email deliverability, product sourcing', NOW(), NOW()),
(21, 'T2ZV0GCNS', 'argued that Angular made him hate coding and said React is the only framework worth using — recurring debate with JR-15', NOW(), NOW()),
(21, 'T2ZV0GCNS', 'references cannabis use casually — uses "vibe coding" to describe building personal projects with AI', NOW(), NOW());

-- csheridan (userIdId: 22)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(22, 'T2ZV0GCNS', 'greets the group with "good morning libs" or "morning libtards"', NOW(), NOW()),
(22, 'T2ZV0GCNS', 'works in advertising sales — shares quota progress, bonus multiplier status, commission details', NOW(), NOW()),
(22, 'T2ZV0GCNS', 'Rutgers fan who organizes watch parties and buys game tickets', NOW(), NOW()),
(22, 'T2ZV0GCNS', 'provides amateur weather forecasting — references European and American models', NOW(), NOW()),
(22, 'T2ZV0GCNS', 'Yankees fan who follows them closely', NOW(), NOW()),
(22, 'T2ZV0GCNS', 'organized and ran a group Powerball lottery pool multiple times', NOW(), NOW()),
(22, 'T2ZV0GCNS', 'shares cooking photos and recipes, particularly salmon dishes', NOW(), NOW());

-- Artiste (userIdId: 25)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(25, 'T2ZV0GCNS', 'works as a teacher — posts about classroom experiences', NOW(), NOW()),
(25, 'T2ZV0GCNS', 'uses moonbeam to ask provocative or humorous questions', NOW(), NOW()),
(25, 'T2ZV0GCNS', 'buys and discusses crypto — particularly Bitcoin and XRP', NOW(), NOW()),
(25, 'T2ZV0GCNS', 'plays in multiple fantasy football leagues', NOW(), NOW()),
(25, 'T2ZV0GCNS', 'refers to himself as Italian-American', NOW(), NOW()),
(25, 'T2ZV0GCNS', 'frames everyday situations using gaming and RPG language', NOW(), NOW()),
(25, 'T2ZV0GCNS', 'Jets fan — laments being one', NOW(), NOW());

-- patrick.obrien908 (userIdId: 35)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(35, 'T2ZV0GCNS', 'diehard Everton FC fan — discusses relegation concerns with resigned acceptance', NOW(), NOW()),
(35, 'T2ZV0GCNS', 'live-comments Premier League, Champions League, and broader European football', NOW(), NOW()),
(35, 'T2ZV0GCNS', 'Yankees fan', NOW(), NOW()),
(35, 'T2ZV0GCNS', 'Atlanta Falcons fan who vents frustration about the team', NOW(), NOW()),
(35, 'T2ZV0GCNS', 'into beer and pub culture — Guinness, Chimay, Belgian and English beer', NOW(), NOW()),
(35, 'T2ZV0GCNS', 'watches and discusses TV shows — The Leftovers (favorite show), Severance, Last of Us, Fallout, Fargo, Sopranos', NOW(), NOW()),
(35, 'T2ZV0GCNS', 'uses "that whips", "that rocks", "hell yeah", and "sick" as go-to positive reactions', NOW(), NOW()),
(35, 'T2ZV0GCNS', 'owns a Steam Deck and is enthusiastic about Hitman', NOW(), NOW());

-- Vinceborg 2050 (userIdId: 41)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(41, 'T2ZV0GCNS', 'Arsenal fan — analyzes matches in detail including player performance, tactical patterns, and xG stats', NOW(), NOW()),
(41, 'T2ZV0GCNS', 'engages with patrick_odowd and patrick.obrien908 specifically about Premier League football', NOW(), NOW()),
(41, 'T2ZV0GCNS', 'mocks Tottenham — St Totteringham''s Day, relegation troubles', NOW(), NOW()),
(41, 'T2ZV0GCNS', 'talks F1 with deep technical knowledge including business side — licensing fees, promoter economics, TV contracts', NOW(), NOW()),
(41, 'T2ZV0GCNS', 'mentions having very limited free time due to parenting and work', NOW(), NOW()),
(41, 'T2ZV0GCNS', 'shares music — hip-hop producers, Pete Rock, Big L, Kutmasta Kurt, 100 gecs, Floating Points', NOW(), NOW()),
(41, 'T2ZV0GCNS', 'writes in multi-sentence messages with detailed analysis rather than one-liners', NOW(), NOW());

-- chattkaslack (userIdId: 31)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(31, 'T2ZV0GCNS', 'posts about the Mets — play-by-play commentary, trade analysis, roster opinions', NOW(), NOW()),
(31, 'T2ZV0GCNS', 'shares news articles in the politics channel, predominantly critical of the current administration', NOW(), NOW()),
(31, 'T2ZV0GCNS', 'has recurring political arguments with The Bad Guy', NOW(), NOW()),
(31, 'T2ZV0GCNS', 'lives in the DC area — reports local weather conditions to the group', NOW(), NOW()),
(31, 'T2ZV0GCNS', 'watches NBA playoff basketball, particularly Knicks games', NOW(), NOW()),
(31, 'T2ZV0GCNS', 'plays TimeGuessr', NOW(), NOW());

-- robbie.carter (userIdId: 19)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(19, 'T2ZV0GCNS', 'lives in Texas — complains about grid reliability and heat', NOW(), NOW()),
(19, 'T2ZV0GCNS', 'posted about Notre Dame football consistently through fall 2025', NOW(), NOW()),
(19, 'T2ZV0GCNS', 'participates in fantasy football and gaming — Battlefield, Battlefront 2', NOW(), NOW());

-- jonk. (userIdId: 26)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(26, 'T2ZV0GCNS', 'training for a marathon — does early morning runs', NOW(), NOW()),
(26, 'T2ZV0GCNS', 'posts about the Mets', NOW(), NOW()),
(26, 'T2ZV0GCNS', 'shares music with an emo/punk preference — strongly dislikes EDM with singing', NOW(), NOW()),
(26, 'T2ZV0GCNS', 'discussed tabletop RPGs extensively — advocates for Dungeon World over D&D', NOW(), NOW());

-- rgerrity4 (userIdId: 24)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(24, 'T2ZV0GCNS', 'posted about the Yankees throughout 2025', NOW(), NOW()),
(24, 'T2ZV0GCNS', 'won the group''s fantasy football championship in late 2025', NOW(), NOW()),
(24, 'T2ZV0GCNS', 'Lions fan', NOW(), NOW());

-- foxZdoxZ (userIdId: 2)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(2, 'T2ZV0GCNS', 'participates in hip hop music discussions', NOW(), NOW()),
(2, 'T2ZV0GCNS', 'did a blacksmithing class', NOW(), NOW());

-- jcal (userIdId: 23)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(23, 'T2ZV0GCNS', 'Patriots fan', NOW(), NOW()),
(23, 'T2ZV0GCNS', 'started sports betting in early 2026', NOW(), NOW());

-- kaskiw911 (userIdId: 51)
INSERT INTO memory (userIdId, teamId, content, createdAt, updatedAt) VALUES
(51, 'T2ZV0GCNS', 'plays WoW hardcore — leveled multiple characters to 60 on private servers', NOW(), NOW()),
(51, 'T2ZV0GCNS', 'extremely low posting frequency — a lurker', NOW(), NOW());
