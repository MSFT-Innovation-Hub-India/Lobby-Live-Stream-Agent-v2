# Contributing to AI Eye - Hub Lobby Live Stream Agent v2

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Lobby-Live-Stream-Agent-v2.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes thoroughly
6. Commit with clear messages: `git commit -m "Add feature: your feature description"`
7. Push to your fork: `git push origin feature/your-feature-name`
8. Open a Pull Request

## Development Setup

### Prerequisites
- Node.js v18+
- npm v9+
- FFmpeg
- Git
- **AI backend** (one of):
  - NVIDIA GPU + vLLM + Phi-4-multimodal (edge mode)
  - Azure OpenAI account (cloud mode, optional for AI features)

### Installation
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Running in Development
```bash
# Terminal 1: Backend
cd backend
npm start

# Terminal 2: Frontend
cd frontend
npm run dev
```

## Code Style Guidelines

### JavaScript/React (JSX, not TypeScript)
- Use ES6+ syntax
- Prefer `const` over `let`, avoid `var`
- Use arrow functions for callbacks
- Use destructuring where appropriate
- Use template literals for string interpolation
- Keep functions small and focused
- Add JSDoc comments for complex functions
- **We use JSX (JavaScript)** instead of TypeScript for simplicity

**Why JSX?**
- Faster development without type definitions
- Easier for beginners to understand
- More flexible for rapid prototyping
- Fewer build configuration issues

### React Components
- Use functional components with hooks
- Keep components focused on single responsibility
- Extract reusable logic into custom hooks
- Use descriptive prop names
- Validate props when necessary
- Prefer unified components over many small ones (see LobbyDashboard)

### File Naming
- Components: PascalCase (e.g., `StreamControls.jsx`)
- Services: camelCase (e.g., `streamService.js`)
- CSS: Match component name (e.g., `StreamControls.css`)

### Code Organization
```
frontend/src/
├── components/     # React components
├── services/       # API and business logic
├── hooks/          # Custom React hooks (if added)
└── utils/          # Utility functions (if added)

backend/
├── routes/         # Express routes
├── services/       # Business logic
├── system-prompts/ # Scenario-specific AI prompt files
│   ├── hub-lobby-default/  # Innovation Hub (markdown output)
│   └── ai-first-bank/     # Banking security (JSON output)
├── middleware/     # Express middleware (if added)
└── utils/          # Utility functions (if added)
```

## Testing Guidelines

### Before Submitting PR
- [ ] Code runs without errors
- [ ] All new features are tested manually
- [ ] No console errors or warnings
- [ ] Existing functionality still works
- [ ] Documentation is updated

### Testing Checklist
- Backend starts successfully
- Frontend builds without errors
- Stream starts and displays video
- Frame capture works (wait 60 seconds)
- **Frame modal opens on click**
- **Countdown timer is visible and accurate**
- **Status syncs with backend** (test by stopping backend)
- **Model name displays correctly** (check against .env — e.g. `microsoft/Phi-4-multimodal-instruct` or `gpt-4o-mini`)
- **Model mode displays correctly** (edge or cloud)
- **HLS player doesn't re-initialize** during status polling
- UI is responsive on mobile/tablet
- Error handling works correctly
- **Memory stays stable** (run for extended period, check frames capped at 10)

## Pull Request Guidelines

### PR Title Format
Use conventional commit format:
- `feat: Add new feature`
- `fix: Fix bug description`
- `docs: Update documentation`
- `style: Code style changes`
- `refactor: Code refactoring`
- `perf: Performance improvements`
- `test: Add tests`
- `chore: Maintenance tasks`

### PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing
Describe how you tested these changes

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] My code follows the project style guidelines
- [ ] I have tested my changes
- [ ] I have updated documentation
- [ ] My changes don't break existing functionality
```

## Areas for Contribution

### High Priority
- [ ] WebSocket support for real-time updates
- [ ] Multiple camera support
- [ ] User authentication and authorization
- [ ] Unit and integration tests
- [ ] Docker containerization
- [ ] CI/CD pipeline

### Medium Priority
- [ ] Recording functionality
- [ ] Playback controls for historical footage
- [ ] Advanced AI features (object detection, alerts)
- [ ] Mobile responsive improvements
- [ ] Performance optimizations
- [ ] Better error handling and recovery

### Documentation
- [ ] API documentation
- [ ] Code comments and JSDoc
- [ ] Architecture diagrams
- [ ] Video tutorials
- [ ] Translation to other languages

### UI/UX Improvements
- [ ] Dark/light theme toggle
- [ ] Better mobile experience
- [ ] Accessibility improvements
- [ ] Keyboard shortcuts
- [ ] Advanced settings panel

## Feature Request Process

1. **Check existing issues** to avoid duplicates
2. **Open a new issue** with "Feature Request" label
3. **Describe the feature** clearly
4. **Explain use case** and benefits
5. **Discuss implementation** with maintainers
6. **Wait for approval** before starting work
7. **Submit PR** once feature is implemented

## Bug Report Process

1. **Search existing issues** for similar bugs
2. **Open a new issue** with "Bug" label
3. **Provide details:**
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment (OS, Node version, etc.)
   - Screenshots/logs if applicable
4. **Wait for triage** by maintainers
5. **Submit PR** with fix if you want to contribute

## Commit Message Guidelines

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding tests
- `chore`: Maintenance tasks

### Examples
```
feat(frontend): Add dark theme toggle

Add ability to switch between dark and light themes.
Theme preference is saved to localStorage.

Closes #123
```

```
fix(backend): Fix memory leak in frame capture

Fixed issue where old frames weren't being deleted properly.
Now keeps only last 20 frames as documented.

Fixes #456
```

## Code Review Process

1. **Maintainer reviews** PR within 1-2 business days
2. **Feedback provided** via comments
3. **Updates requested** if needed
4. **Approval** once all feedback addressed
5. **Merge** by maintainer

## Questions and Support

- **General Questions:** Open a GitHub Discussion
- **Bug Reports:** Open an Issue with "Bug" label
- **Feature Requests:** Open an Issue with "Feature Request" label
- **Security Issues:** Email maintainers directly (see README)

## Code of Conduct

### Our Standards
- Be respectful and inclusive
- Welcome newcomers
- Accept constructive criticism
- Focus on what's best for the community
- Show empathy towards others

### Unacceptable Behavior
- Harassment or discrimination
- Trolling or insulting comments
- Personal or political attacks
- Publishing private information
- Unprofessional conduct

### Enforcement
Violations may result in:
1. Warning
2. Temporary ban
3. Permanent ban

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in project documentation

## Resources

- [Main README](README.md)
- [Architecture Documentation](ARCHITECTURE.md)
- [Testing Guide](TESTING.md)
- [Quick Start Guide](QUICKSTART.md)

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Lobby Live Stream Agent v2! 🎉
