import React from "react";

import Header from "./header";
import Body from "./body";
import PanelBase from "../../base/panelBase";
import { vh } from "@/utils/rpx";

export default function () {
    return (
        <PanelBase
            height={vh(80)}
            keyboardAvoidBehavior="none"
            renderBody={loading => (
                <>
                    <Header />
                    <Body loading={loading} />
                </>
            )}
        />
    );
}
