-- Seed a handful of foundational AI concept articles so the feed isn't empty
-- before the first cron run. These are teacher-authored content; news arrives via
-- the ingest_feeds Edge Function.

INSERT INTO feed_items (type, status, difficulty, title, summary, body, published_at)
VALUES
(
  'concept', 'published', 'foundations',
  'What is Artificial Intelligence?',
  'AI is software that learns to do things humans usually do — see, read, listen, and decide. It learns from examples instead of being told every rule.',
  E'Imagine teaching a friend how to recognise cats. You could write a long list of rules ("pointy ears, whiskers, four legs…"), but the friend would still get confused by an unusual cat.\n\nArtificial Intelligence solves this differently. Instead of rules, you show the computer thousands of cat photos and thousands of non-cat photos, and the program slowly figures out the patterns on its own.\n\nThat''s the trick: AI is software that learns from examples. Modern AI uses something called a neural network — millions of tiny adjustable knobs that get tuned during training until the program gets the right answer. The same idea works for spotting tumours in scans, translating languages, generating images, and answering questions.\n\nThe key thing to remember: AI doesn''t "understand" the way you do. It''s very good at finding patterns in data, and that turns out to be enough for a surprising number of useful tasks.',
  now() - interval '6 days'
),
(
  'concept', 'published', 'foundations',
  'How does ChatGPT actually work?',
  'It''s a giant pattern-matcher trained on huge amounts of text. When you ask it something, it predicts the most likely next word, again and again, until it has written a full reply.',
  E'ChatGPT and similar tools (Claude, Gemini, Llama) are called Large Language Models, or LLMs.\n\nHere''s the simple version of how they work: the model has read most of the public internet — books, articles, code, Reddit posts, you name it. During training, it played a guessing game billions of times: "given the first half of this sentence, what word comes next?" Each correct guess nudges its internal numbers a tiny bit; each wrong guess nudges them in the other direction.\n\nAfter enough rounds, the model becomes very good at one specific thing: predicting plausible next words. When you type a question, the model just keeps predicting the next word in the conversation until it produces a full reply.\n\nThat''s why LLMs sometimes "hallucinate" — they''re not looking up facts, they''re generating text that *sounds* right. They''re writing assistants, not search engines.',
  now() - interval '5 days'
),
(
  'concept', 'published', 'core',
  'What is "training data" and why does it matter?',
  'Training data is the examples an AI learns from. The quality and variety of that data quietly decides how the AI behaves — biases included.',
  E'Every AI you use was shaped by the data it learned from. Spam filters learned from millions of labelled emails. Image generators learned from billions of captioned pictures. ChatGPT learned from a huge slice of the public internet.\n\nThis matters more than people realise:\n\n• If the training data only contains photos of light-skinned faces, the model will be worse at recognising dark-skinned faces.\n• If the training data is mostly English, the model will be sharper in English than in Urdu or Danish.\n• If the training data includes biased opinions, the model can echo those biases in its answers.\n\nThis is one of the deepest questions in modern AI: who decides what goes into the training set, and who gets left out? When you read about "AI bias," this is usually what people mean — the bias was already in the data, and the model faithfully learned it.\n\nA good habit: when an AI answers something confidently, ask yourself "what data taught it that?"',
  now() - interval '4 days'
),
(
  'concept', 'published', 'core',
  'Tokens, prompts, and context windows — the basic vocabulary',
  'A token is a small chunk of text (often a word or part of a word). A prompt is what you send the model. The context window is how much it can read at once.',
  E'Three words you''ll keep seeing:\n\n**Token.** When an LLM reads text, it doesn''t see whole words — it sees small chunks called tokens. "Programming" might be one token; an unusual name might be split into three. As a rule of thumb, 1 token ≈ ¾ of an English word. APIs charge by tokens, so longer text costs more.\n\n**Prompt.** This is everything you send to the model — your question, plus any instructions, plus any example answers, plus any documents you''ve pasted in. Better prompts give better answers. There''s a whole emerging skill called "prompt engineering" that''s really just "thinking carefully about how to ask."\n\n**Context window.** This is how many tokens the model can pay attention to at once. Older models could only see ~4,000 tokens (a few pages). Modern models can see 200,000+ (a whole book). Beyond that, the model literally cannot remember what was at the start of the conversation — like a person who forgets the beginning of a long meeting.\n\nIf you understand these three, you''re past the hardest part of the jargon.',
  now() - interval '3 days'
),
(
  'concept', 'published', 'advanced',
  'Why "open source" AI is more complicated than it sounds',
  'When a company releases an AI model, what counts as "open"? Just the weights? The code? The training data? Each choice has very different consequences.',
  E'In normal software, "open source" has a clear meaning: you can read the code, change it, and share your changes. With AI it''s much messier.\n\nA modern AI model has three parts:\n\n1. **Architecture** — the design of the neural network (usually published in research papers, freely shared)\n2. **Weights** — the trained numbers that make the model actually work (this is the expensive bit)\n3. **Training data** — the texts/images/code the model learned from (rarely shared, often legally murky)\n\nWhen Meta releases Llama, you get the architecture and the weights — but not the training data, and there are restrictions on commercial use. So is that "open"? Some people say yes; others coined the term "open-weights" to be more honest.\n\nWhy this matters for you as a learner:\n\n• Open-weights models can run on your own laptop or a cheap cloud server. Closed models like GPT-4 and Claude can only run on the original company''s servers.\n• Open-weights models can be inspected and audited. Closed models are black boxes.\n• Open-weights models can be fine-tuned for special tasks. Closed models can only be prompted.\n\nThe big question for the next decade: will the strongest models stay closed, or will open-weights models catch up? Right now they''re much closer than most people think.',
  now() - interval '2 days'
)
ON CONFLICT (source_url) DO NOTHING;
