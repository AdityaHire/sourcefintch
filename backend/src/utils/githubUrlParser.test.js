const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parse } = require('./githubUrlParser');

describe('githubUrlParser', () => {
  it('parses standard https URL', () => {
    const result = parse('https://github.com/facebook/react');
    assert.deepStrictEqual(result, { owner: 'facebook', repo: 'react' });
  });

  it('strips trailing slash', () => {
    const result = parse('https://github.com/facebook/react/');
    assert.deepStrictEqual(result, { owner: 'facebook', repo: 'react' });
  });

  it('strips .git suffix', () => {
    const result = parse('https://github.com/facebook/react.git');
    assert.deepStrictEqual(result, { owner: 'facebook', repo: 'react' });
  });

  it('strips both trailing slash and .git', () => {
    const result = parse('https://github.com/facebook/react.git/');
    assert.deepStrictEqual(result, { owner: 'facebook', repo: 'react' });
  });

  it('accepts http scheme', () => {
    const result = parse('http://github.com/facebook/react');
    assert.deepStrictEqual(result, { owner: 'facebook', repo: 'react' });
  });

  it('rejects non-GitHub host', () => {
    assert.throws(() => parse('https://gitlab.com/facebook/react'), /github\.com/);
  });

  it('rejects invalid URL', () => {
    assert.throws(() => parse('not-a-url'), /Invalid URL/);
  });

  it('rejects URL missing repo', () => {
    assert.throws(() => parse('https://github.com/facebook'), /owner and repository/);
  });

  it('rejects URL with extra path segments', () => {
    const result = parse('https://github.com/facebook/react/issues');
    assert.strictEqual(result.repo, 'react');
  });
});
