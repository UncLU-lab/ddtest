import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ImportSofFixtureDto } from './dto/import-sof-fixture.dto';
import {
  SofFixtureImportService,
  type SofFixtureImportResult,
} from './sof-fixture-import.service';

@Controller()
export class SofFixtureImportController {
  constructor(private readonly importService: SofFixtureImportService) {}

  @Post('voyages/:voyageId/sof-fixtures/import')
  importFixture(
    @Param('voyageId', ParseUUIDPipe) voyageId: string,
    @Body() fixture: ImportSofFixtureDto,
  ): Promise<SofFixtureImportResult> {
    return this.importService.importFixture(voyageId, fixture);
  }
}
