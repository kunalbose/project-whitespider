import React from 'react'
import styled from 'styled-components'

const Loader = () => {
  return (
    <FullWidthWrapper>
      <div className="loader" />
    </FullWidthWrapper>
  )
}

const FullWidthWrapper = styled.div`
  width: 100%;
  height: 4px;
  position: relative;
  background-color: rgba(0, 0, 0, 0.1);
  overflow: hidden;

  .loader {
    --loader-color: blueviolet;
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
  }

  .loader::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 0%;
    background-color: var(--loader-color);
    animation: moving 1.5s ease-in-out infinite;
  }

  @keyframes moving {
    0% {
      width: 0%;
      left: 0;
    }
    50% {
      width: 100%;
      left: 0;
    }
    100% {
      width: 0%;
      left: 100%;
    }
  }
`

export default Loader
