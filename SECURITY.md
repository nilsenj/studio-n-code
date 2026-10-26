# Security

studio-n-code is currently a development release. No long-term-support version or signed installer is available yet.

Do not put credentials, tokens, private source, account data or unredacted logs in public issues. For a vulnerability, use GitHub's private vulnerability-reporting option on the repository's Security tab when available. Otherwise contact the maintainer through GitHub without including exploit details in a public post.

Reports should identify the affected version or commit, platform, impact, and minimal reproduction steps. Patches should include a regression check where practical.

The app can execute terminals, debugger configurations and extensions with the local user's privileges. Review projects and extensions before running their code. Default development setup does not disable workspace trust for normal use; the disposable smoke runner explicitly disables it only for its generated fixture.
