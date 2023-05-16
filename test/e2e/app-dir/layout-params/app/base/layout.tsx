import React from 'react'
import ShowParams from '../show-params'

export default function Layout({
  children,
  params,
}: {
  children: React.ReactNode
  params: {}
}) {
  return (
    <div>
      <ShowParams prefix="lvl1" params={params} />
      {children}
    </div>
  )
}
