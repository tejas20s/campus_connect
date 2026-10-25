import { describe, expect, it } from 'vitest';
import { emailLayout } from '../src/services/email.js';

describe('emailLayout', () => {
  it('renders a branded email and escapes untrusted content', () => {
    const html = emailLayout('Application received', '<script>alert("x")</script>');

    expect(html).toContain('CampusConnect');
    expect(html).toContain('Your campus career network');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('role="presentation"');
  });
});
