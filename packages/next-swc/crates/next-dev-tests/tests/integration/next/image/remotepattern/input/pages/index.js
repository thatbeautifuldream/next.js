import Image from 'next/image'
import { useTestHarness } from '@turbo/pack-test-harness'

export default function Home() {
  useTestHarness(runTests)

  // Only the jpg is approved in the NextConfig's image.remotePatterns.
  return (
    <Image
      id="external"
      alt="test src image"
      src="https://image-optimization-test.vercel.app/test.jpg"
      width="100"
      height="100"
    />
  )
}

function runTests() {
  it('it should link to approved external image', () => {
    const img = document.querySelector('#external')
    expect(img.src).toContain(encodeURIComponent('test.jpg'))
  })

  it('it should not link to unapproved external image', async () => {
    const res = await fetch('/invalid')
    const text = await res.text()
    expect(text).toMatch(/Error: Invalid src prop/)
  })
}
