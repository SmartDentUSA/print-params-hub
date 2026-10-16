import { describe, it, expect } from 'vitest';
import { publicRedirectTarget } from './adminPublicRedirect';

describe('admin public redirect', () => {
  it('moves public knowledge pages from admin to www', () => {
    expect(publicRedirectTarget('admin.smartdent.com.br', '/base-conhecimento/a/x', '?q=1', ''))
      .toBe('https://www.smartdent.com.br/base-conhecimento/a/x?q=1');
  });
  it('keeps internal tools on admin', () => {
    expect(publicRedirectTarget('admin.smartdent.com.br', '/smartops', '', '')).toBeNull();
    expect(publicRedirectTarget('admin.smartdent.com.br', '/portal-cursos/abc', '', '')).toBeNull();
  });
  it('does nothing on www', () => {
    expect(publicRedirectTarget('www.smartdent.com.br', '/base-conhecimento', '', '')).toBeNull();
  });
});
