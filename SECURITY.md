# Security Policy

## Supported Versions

Currently, security updates are actively provided for the latest release:

| Version | Supported          |
|---------|--------------------|
| 1.8.x   | :white_check_mark: |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in PortScope, please report it responsibly:

1. **GitHub Private Vulnerability Reporting** (preferred): Go to the [Security Advisories](https://github.com/Neilblaze/portscope/security/advisories) page and click "Report a vulnerability".
2. **Email**: Send details directly to the maintainer at **dev@neilblaze.live**.

### What to Include
- A description of the vulnerability and its potential impact
- Clear steps or a proof of concept (PoC) to reproduce the issue
- Affected version(s)
- Suggested fix, if you have one

### What to Expect
- **Acknowledgement** within 48 hours of your report.
- **Status update** within 7 days with an initial assessment.
- **Resolution target** within 30 days for confirmed vulnerabilities, depending on complexity.

We will coordinate disclosure with you and ask that you give us reasonable time to address the issue before making it public.

## What Qualifies as a Security Issue

PortScope runs locally on your machine and handles local shell executions, port scanning, and cloud provider API keys for AI execution. Issues we consider security-relevant include:

- Secrets/credentials leakage or insecure storage of provider API keys
- Command injection or path traversal vulnerabilities in scanner, restart, or kill commands
- Bypass of the OS-aware system process guard or prompt confirmation steps in interactive mode
- Dependency vulnerabilities with a known exploit path
- Anything else that could compromise the security of PortScope or its users

If you're unsure whether something counts, report it anyway. I would rather triage a false positive than miss a real issue.

## Recognition

We appreciate responsible disclosure. Contributors who report valid vulnerabilities will be credited in our release notes (unless they prefer to remain anonymous).