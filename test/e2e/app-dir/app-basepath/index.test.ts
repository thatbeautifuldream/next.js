import { createNextDescribe } from 'e2e-utils'

createNextDescribe(
  'app dir basepath',
  {
    files: __dirname,
    skipDeployment: true,
    dependencies: {
      react: 'latest',
      'react-dom': 'latest',
      sass: 'latest',
    },
  },
  ({ next }) => {
    it('should support `basePath`', async () => {
      const html = await next.render('/base')
      expect(html).toContain('<h1>Test Page</h1>')
    })

    it('should support Link with basePath prefixed', async () => {
      const browser = await next.browser('/base')
      expect(
        await browser
          .elementByCss('a[href="/base/another"]')
          .click()
          .waitForElementByCss('#page-2')
          .text()
      ).toBe(`Page 2`)
    })

    it('should prefix metadata og image with basePath', async () => {
      const $ = await next.render$('/base/another')
      const ogImageHref = $('meta[property="og:image"]').attr('content')

      expect(ogImageHref).toContain('/base/another/opengraph-image.png')
    })
  }
)
