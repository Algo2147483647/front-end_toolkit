export function createSvgPathTools({ state, roundCoordinate }) {
  function tokenizePathData(d) {
    return String(d || "").match(/[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  }

  function parseSimpleCubicBezier(node) {
    const tokens = tokenizePathData(node?.getAttribute?.("d"));
    if (tokens.length !== 10 || tokens[0].toUpperCase() !== "M" || tokens[3].toUpperCase() !== "C") {
      return null;
    }

    const numbers = tokens
      .filter((token) => !/^[A-Za-z]$/.test(token))
      .map((token) => Number.parseFloat(token));
    if (numbers.length !== 8 || numbers.some((value) => !Number.isFinite(value))) {
      return null;
    }

    return {
      start: { x: numbers[0], y: numbers[1] },
      control1: { x: numbers[2], y: numbers[3] },
      control2: { x: numbers[4], y: numbers[5] },
      end: { x: numbers[6], y: numbers[7] }
    };
  }

  function serializeSimpleCubicBezier(bezier) {
    return `M ${roundCoordinate(bezier.start.x)} ${roundCoordinate(bezier.start.y)} C ${roundCoordinate(bezier.control1.x)} ${roundCoordinate(bezier.control1.y)}, ${roundCoordinate(bezier.control2.x)} ${roundCoordinate(bezier.control2.y)}, ${roundCoordinate(bezier.end.x)} ${roundCoordinate(bezier.end.y)}`;
  }

  function projectPointToRoot(node, point) {
    const svgPoint = state.svgRoot?.createSVGPoint?.();
    const matrix = node?.getCTM?.();
    if (!svgPoint || !matrix) {
      return {
        x: point.x,
        y: point.y
      };
    }

    svgPoint.x = point.x;
    svgPoint.y = point.y;
    return svgPoint.matrixTransform(matrix);
  }

  function translateSimpleCubicBezier(bezier, dx, dy) {
    return {
      start: {
        x: bezier.start.x + dx,
        y: bezier.start.y + dy
      },
      control1: {
        x: bezier.control1.x + dx,
        y: bezier.control1.y + dy
      },
      control2: {
        x: bezier.control2.x + dx,
        y: bezier.control2.y + dy
      },
      end: {
        x: bezier.end.x + dx,
        y: bezier.end.y + dy
      }
    };
  }

  function translatePathData(d, dx, dy) {
    const tokens = tokenizePathData(d);
    if (!tokens.length) {
      return String(d || "");
    }

    const parameterLengths = {
      A: 7,
      C: 6,
      H: 1,
      L: 2,
      M: 2,
      Q: 4,
      S: 4,
      T: 2,
      V: 1,
      Z: 0
    };
    const shiftAbsoluteValues = (command, values) => {
      const upper = command.toUpperCase();
      if (upper === "H") {
        return values.map((value) => roundCoordinate(value + dx));
      }
      if (upper === "V") {
        return values.map((value) => roundCoordinate(value + dy));
      }
      if (upper === "A") {
        return values.map((value, index) => {
          if (index % 7 === 5) return roundCoordinate(value + dx);
          if (index % 7 === 6) return roundCoordinate(value + dy);
          return roundCoordinate(value);
        });
      }
      return values.map((value, index) => roundCoordinate(value + (index % 2 === 0 ? dx : dy)));
    };

    let index = 0;
    let currentCommand = null;
    let hasStarted = false;
    const output = [];

    while (index < tokens.length) {
      const token = tokens[index];
      if (/^[A-Za-z]$/.test(token)) {
        currentCommand = token;
        output.push(token);
        index += 1;
        if (currentCommand.toUpperCase() === "Z") {
          continue;
        }
      }

      if (!currentCommand) {
        break;
      }

      const upper = currentCommand.toUpperCase();
      const parameterLength = parameterLengths[upper];
      if (!parameterLength) {
        continue;
      }

      while (index + parameterLength - 1 < tokens.length && !/^[A-Za-z]$/.test(tokens[index])) {
        const rawValues = tokens.slice(index, index + parameterLength);
        if (rawValues.some((value) => /^[A-Za-z]$/.test(value))) {
          break;
        }

        const values = rawValues.map((value) => Number.parseFloat(value));
        let shiftedValues = values;

        if (currentCommand === currentCommand.toUpperCase()) {
          shiftedValues = shiftAbsoluteValues(currentCommand, values);
        } else if (currentCommand === "m" && !hasStarted) {
          shiftedValues = [
            roundCoordinate(values[0] + dx),
            roundCoordinate(values[1] + dy),
            ...values.slice(2).map((value) => roundCoordinate(value))
          ];
        } else {
          shiftedValues = values.map((value) => roundCoordinate(value));
        }

        output.push(...shiftedValues.map((value) => String(value)));
        index += parameterLength;
        if (upper === "M") {
          hasStarted = true;
          currentCommand = currentCommand === "M" ? "L" : "l";
        } else {
          hasStarted = true;
        }
      }
    }

    return output.join(" ");
  }

  function getPathBezier(node) {
    return parseSimpleCubicBezier(node);
  }

  function updatePathBezier(node, bezier) {
    const nextBezier = {
      start: {
        x: Number.parseFloat(bezier?.start?.x),
        y: Number.parseFloat(bezier?.start?.y)
      },
      control1: {
        x: Number.parseFloat(bezier?.control1?.x),
        y: Number.parseFloat(bezier?.control1?.y)
      },
      control2: {
        x: Number.parseFloat(bezier?.control2?.x),
        y: Number.parseFloat(bezier?.control2?.y)
      },
      end: {
        x: Number.parseFloat(bezier?.end?.x),
        y: Number.parseFloat(bezier?.end?.y)
      }
    };

    const values = [
      nextBezier.start.x,
      nextBezier.start.y,
      nextBezier.control1.x,
      nextBezier.control1.y,
      nextBezier.control2.x,
      nextBezier.control2.y,
      nextBezier.end.x,
      nextBezier.end.y
    ];
    if (values.some((value) => !Number.isFinite(value))) {
      return false;
    }

    node.setAttribute("d", serializeSimpleCubicBezier(nextBezier));
    return true;
  }

  function getPathBezierHandles(node) {
    const bezier = parseSimpleCubicBezier(node);
    if (!bezier) {
      return [];
    }

    return [
      { key: "start", kind: "anchor", ...projectPointToRoot(node, bezier.start) },
      { key: "control1", kind: "control", ...projectPointToRoot(node, bezier.control1) },
      { key: "control2", kind: "control", ...projectPointToRoot(node, bezier.control2) },
      { key: "end", kind: "anchor", ...projectPointToRoot(node, bezier.end) }
    ];
  }

  function getPathBezierHandleDescriptor(node, handle) {
    const bezier = parseSimpleCubicBezier(node);
    const pointKey = ["start", "control1", "control2", "end"].includes(handle) ? handle : null;
    const startHandle = pointKey ? bezier?.[pointKey] : null;
    if (!startHandle) {
      return null;
    }

    return {
      handle: pointKey,
      startHandle: {
        x: startHandle.x,
        y: startHandle.y
      }
    };
  }

  function applyPathBezierHandle(node, descriptor, point) {
    const bezier = parseSimpleCubicBezier(node);
    if (!bezier || !descriptor?.handle || !bezier[descriptor.handle]) {
      return false;
    }

    bezier[descriptor.handle] = {
      x: point.x,
      y: point.y
    };
    node.setAttribute("d", serializeSimpleCubicBezier(bezier));
    return true;
  }

  return {
    applyPathBezierHandle,
    getPathBezier,
    getPathBezierHandleDescriptor,
    getPathBezierHandles,
    parseSimpleCubicBezier,
    serializeSimpleCubicBezier,
    tokenizePathData,
    translatePathData,
    translateSimpleCubicBezier,
    updatePathBezier
  };
}
