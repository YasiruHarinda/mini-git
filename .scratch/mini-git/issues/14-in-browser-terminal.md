# 14 — In-browser terminal

**What to build:** A command line in the page. Someone types the same commands
the CLI accepts and sees the same output, with the rest of the interface
updating around them as the Repository changes.

This is worth building for two reasons beyond novelty. It makes the whole
project demonstrable in about a minute without hunting for buttons, which
matters when the audience is watching rather than using. And it keeps the
interface honest: if a command works in the terminal but the panels do not
update, the interface is holding state the engine should own.

The parser is shared with the CLI rather than reimplemented — two parsers
would drift, and the claim that this accepts "the same commands" would quietly
stop being true.

**Blocked by:** 07 (the full command set exists) and 09 (an interface to
embed in).

**Status:** ready-for-agent

- [ ] Commands are typed and their output is printed in the page
- [ ] `init`, `add`, `unstage`, `commit`, `log`, `branch`, `checkout`, `merge`, `diff` all work
- [ ] Command parsing is shared with the command line tool, not duplicated
- [ ] Every panel in the interface updates when a command changes the Repository
- [ ] Errors print the same message the CLI prints, including checkout's named blocking paths
- [ ] Command history is navigable with the arrow keys
- [ ] Output scrolls within the terminal container without the page scrolling
- [ ] Unknown commands produce a helpful message listing what is available
