import { createNextDescribe } from 'e2e-utils'

createNextDescribe(
  'use-params',
  {
    files: __dirname,
  },
  ({ next }) => {
    it('should work for single dynamic param', async () => {
      const $ = await next.render$('/a/b')
      expect($('#param-id').text()).toBe('a')
    })
    it('should work for nested dynamic params', async () => {
      const $ = await next.render$('/a/b')
      expect($('#param-id').text()).toBe('a')
      expect($('#param-id2').text()).toBe('b')
    })

    it('should work for single dynamic param client navigating', async () => {
      const browser = await next.browser('/')
      expect(
        await browser
          .elementByCss('#to-a')
          .click()
          .waitForElementByCss('#param-id')
          .text()
      ).toBe('a')
    })

    it('should work for nested dynamic params client navigating', async () => {
      const browser = await next.browser('/')
      await browser
        .elementByCss('#to-a-b')
        .click()
        .waitForElementByCss('#param-id')
      expect(await browser.elementByCss('#param-id').text()).toBe('a')
      expect(await browser.elementByCss('#param-id2').text()).toBe('b')
    })

    it('should return null in pages', async () => {
      const browser = await next.browser('/use-params-pages')

      expect(await browser.elementByCss('#params').text()).toBe('null')
    })
  }
)
